# Push Notifications Spec

Web Push notifications for new movies, with iPhone (iOS 16.4+ PWA) as the primary target.

## Goal

When a user adds a movie via the `addMovie` mutation, every _other_ opted-in user receives a push notification on their device:

> Alice added "Dune" to the queue

On iPhone this is delivered as a native-style notification, but only when the site has been installed to the Home Screen (iOS 16.4+ requirement).

## Architectural overview

A user installs MovieNight to their iOS Home Screen. On first launch they see a "Turn on notifications" CTA. Clicking it triggers the standard permission prompt, registers a Service Worker, calls `pushManager.subscribe(...)` with the server's VAPID public key, and POSTs the resulting `PushSubscription` JSON to the backend. The backend stores it per-user. When any other user calls `addMovie`, the resolver awaits an audit-log write and then asynchronously fans out a Web Push payload to all subscribed users except the requester, using the `web-push` npm package. Subscriptions returning `404`/`410` are pruned.

## 1. HTTPS prerequisite (operator action)

Service Workers and the Push API refuse to run on insecure origins (except `localhost`). The current `nginx.conf` listens on port 80 only.

**Operator must:**

- Stand up an external reverse proxy in front of the existing `:8080` container — see existing recipe in `DEPLOYMENT.md` "Custom Domain with SSL" section.
- Serve from a real hostname (TMDB and certbot won't issue certs to bare IPs).
- The manifest's `start_url` must be same-origin (already true).

The app's own nginx config is **not** modified; TLS termination happens externally.

## 2. VAPID keys

Generate once per deployment:

```
npx web-push generate-vapid-keys
```

Env vars (bare names, backend-only — match `SMTP_*` / `JWT_SECRET` / `TMDB_API_KEY`):

| Var                 | Notes                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `VAPID_PUBLIC_KEY`  | Served to frontend via `appInfo.vapidPublicKey`. Public, safe to ship.                   |
| `VAPID_PRIVATE_KEY` | Secret. Used by `web-push` to sign push requests.                                        |
| `VAPID_SUBJECT`     | `mailto:` or `https://` identifying the app. Default: `mailto:noreply@movienight.local`. |

No `REACT_APP_VAPID_PUBLIC_KEY` — that would bake the key into the bundle at build time and force a rebuild on rotation. Fetching via GraphQL keeps it dynamic.

## 3. Backend

### 3.1 Packages

- `web-push` (runtime)
- `@types/web-push` (dev)

### 3.2 Migrations

**`<ts>_create-push-subscriptions.js`**

```
Table: push_subscriptions
- id            SERIAL PK
- user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
- endpoint      TEXT    NOT NULL
- p256dh        TEXT    NOT NULL
- auth          TEXT    NOT NULL
- user_agent    TEXT
- created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
- last_used_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
- failure_count INTEGER NOT NULL DEFAULT 0

Constraints: UNIQUE(endpoint)
Indexes:     (user_id)
```

Endpoint is globally unique per the Push API spec — same browser re-subscribing upserts on `endpoint`, multi-device users get multiple rows naturally.

**`<ts>_create-user-notification-preferences.js`**

```
Table: user_notification_preferences
- id          SERIAL PK
- user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
- event_type  VARCHAR(64) NOT NULL
- enabled     BOOLEAN NOT NULL DEFAULT TRUE
- created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()

Constraints: UNIQUE(user_id, event_type)
Indexes:     (user_id)
```

**Trade-off — separate table vs column on `users`**: separate table chosen. Reasons: extensibility (`MOVIE_WATCHED`, `CONNECTION_REQUEST` etc. become rows, not migrations); `users` is already wide; matches the established `tags` / `movie_user_tags` split. Default behavior: absent row = enabled (no backfill needed).

### 3.3 `backend/src/push.ts` (new)

Encapsulates all `web-push` interaction. Same pattern as `email.ts`. Exports:

```ts
export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export function configurePush(): boolean;
export async function sendPushToUser(
  userId: number,
  payload: PushPayload,
): Promise<{ delivered: number; pruned: number }>;
export async function sendPushToUsersExcept(
  excludeUserId: number,
  eventType: string,
  payload: PushPayload,
): Promise<{ delivered: number; pruned: number }>;
```

Behavior:

- `configurePush()` called once at startup. If VAPID env vars are unset, logs a warning and send functions become no-ops (mirrors `TMDB_API_KEY` gating).
- Fan-out query joins `push_subscriptions` × `user_notification_preferences`, excluding requester and any user with `enabled = false` for the event type.
- Per-subscription result handling:
  - 2xx → `UPDATE … SET last_used_at = NOW(), failure_count = 0`
  - 404 / 410 → `DELETE` (subscription dead per RFC 8030)
  - other 4xx / 5xx → `failure_count + 1`; delete when threshold (5) reached
- **Never** log `endpoint`, `p256dh`, or `auth`. Log only DB id + HTTP status.

### 3.4 Hook into `addMovie` resolver

Located in `backend/src/resolvers.ts`. After the existing `logAudit('MOVIE_ADD', …)`:

```ts
sendPushToUsersExcept(context.user.userId, 'MOVIE_ADD', {
  title: 'New movie added',
  body: `${requesterName} added "${title}" to the queue`,
  url: '/',
  tag: `movie-add-${newMovieId}`,
}).catch((err) => console.error('Push fan-out failed:', err));
```

**Fire-and-forget**, justified:

1. **Latency** — `web-push` fans out N parallel HTTPS calls to Apple/Google/Mozilla; P99 can be multi-second.
2. **Reliability** — a flaky push service must not fail the mutation.
3. **Testability** — the resolver test only asserts invocation; correctness lives in `push.test.ts`.

### 3.5 GraphQL schema additions

```graphql
input PushSubscriptionInput {
  endpoint: String!
  keys: PushSubscriptionKeysInput!
}
input PushSubscriptionKeysInput {
  p256dh: String!
  auth: String!
}

type NotificationPreference {
  eventType: String!
  enabled: Boolean!
}

extend type AppInfo {
  vapidPublicKey: String # null when push not configured
}

extend type Query {
  notificationPreferences: [NotificationPreference!]! # auth required
}

extend type Mutation {
  subscribePush(subscription: PushSubscriptionInput!): Boolean!
  unsubscribePush(endpoint: String!): Boolean!
  updateNotificationPreference(eventType: String!, enabled: Boolean!): NotificationPreference!
}
```

`vapidPublicKey` lives on `AppInfo` to match the existing `isProduction` pattern — one flat query.

### 3.6 Resolvers

- `Query.appInfo.vapidPublicKey` → `process.env.VAPID_PUBLIC_KEY ?? null`
- `Query.notificationPreferences` — auth check; merge canonical event-type list (start: `['MOVIE_ADD']`) with overrides, defaulting to `enabled: true`.
- `Mutation.subscribePush` — auth; validate endpoint is HTTPS and ≤ 8 KB; upsert `ON CONFLICT (endpoint) DO UPDATE SET user_id, p256dh, auth, last_used_at = NOW(), failure_count = 0`; capture `context.userAgent`; audit `PUSH_SUBSCRIBE` with masked UA only (no endpoint).
- `Mutation.unsubscribePush` — auth; `DELETE … WHERE endpoint = $1 AND user_id = $2`; always return `true` to prevent endpoint enumeration; audit `PUSH_UNSUBSCRIBE`.
- `Mutation.updateNotificationPreference` — auth; validate `eventType` against whitelist; upsert; audit `NOTIFICATION_PREFS_UPDATE`.

### 3.7 New audit-log actions

`PUSH_SUBSCRIBE`, `PUSH_UNSUBSCRIBE`, `NOTIFICATION_PREFS_UPDATE` — append to `CLAUDE.md` audit-actions list.

### 3.8 Startup wiring

In `backend/src/index.ts`, after `await initializeDatabase()`, call `configurePush()`.

### 3.9 Tests

- **`backend/src/__tests__/push.test.ts`** — full coverage of `push.ts`:
  - Happy path: fan-out queries excluding requester, posts to `web-push`, marks success
  - 410 / 404 → row deleted
  - 500 → `failure_count++`; row survives
  - Threshold reached → row deleted
  - Preferences honored: `enabled = false` excludes from fan-out
  - Default (no pref row) → included
  - Empty VAPID env → `configurePush` returns false; send is no-op
- **`movie-resolvers.test.ts`** — extend to assert `addMovie` invokes push fan-out with requester excluded and does **not** await it.
- **`notification-resolvers.test.ts`** (new) — `subscribePush` auth + happy + upsert + endpoint validation; `unsubscribePush` cross-user safety; `notificationPreferences` merging; `updateNotificationPreference` whitelist; `appInfo.vapidPublicKey` env handling.
- **`__helpers.ts`** — add `jest.mock('../../push', …)` alongside the email mock.

CI coverage gates apply: 80% / 65%. `push.ts` is small and fully mockable — achievable.

## 4. Frontend

### 4.1 Service worker — `public/sw.js`

Minimal, hand-rolled, push-only (no caching strategy — we're a polling app; caching would conflict with `nginx.conf` HTML cache rules).

```js
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {}
  const title = data.title || 'MovieNight';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/logo192.png',
      badge: '/logo192.png',
      tag: data.tag,
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of clients) {
        if ('focus' in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })(),
  );
});
```

### 4.2 `src/utils/pushClient.ts` (new)

Exports:

- `pushSupported(): boolean`
- `isStandalonePWA(): boolean` — checks `(navigator as any).standalone` (iOS) and `matchMedia('(display-mode: standalone)')`
- `iosVersion(): number | null`
- `registerServiceWorker(): Promise<ServiceWorkerRegistration | null>` — production-only gate
- `subscribeForPush(reg, vapidPublicKey): Promise<PushSubscriptionJSON>`
- `getCurrentSubscription(): Promise<PushSubscriptionJSON | null>`
- `unsubscribeFromPush(): Promise<string | null>` — returns the endpoint that was unsubscribed
- `urlBase64ToUint8Array(base64: string): Uint8Array` (helper)

Registration call lives in a `useEffect` in `App.tsx`, gated `'serviceWorker' in navigator && process.env.NODE_ENV === 'production'`.

### 4.3 `src/components/settings/NotificationSettings.tsx` (new)

UI states:

1. **Unsupported browser** — informational message
2. **iOS Safari, not standalone** — "Add MovieNight to your Home Screen" guidance (Share → Add to Home Screen → open from icon → return here)
3. **iOS < 16.4** — "Your iOS version is too old; iOS 16.4 or later is required"
4. **Permission `default`** — "Turn on notifications" button
5. **Permission `denied`** — explain how to re-enable in OS settings; disabled button
6. **Permission `granted` and subscribed** — "Notifications enabled on this device" + Disable button (severity `'primary'`, not `'warning'` — reversible)
7. **Per-event toggles** — currently one row: "New movies added by others"

Use MUI Joy `Card` + `Switch` + `Button`.

### 4.4 Entry point

New gear `IconButton` in `Navbar.tsx` next to the existing "?" help icon (and a corresponding entry in the mobile drawer). Opens a `<Modal>` whose body is `NotificationSettings`. No router changes (the app doesn't use react-router).

### 4.5 Apollo additions (`src/graphql/queries.ts`)

- Extend existing `GET_APP_INFO` to include `vapidPublicKey`
- `GET_NOTIFICATION_PREFERENCES`
- `SUBSCRIBE_PUSH`
- `UNSUBSCRIBE_PUSH`
- `UPDATE_NOTIFICATION_PREFERENCE`

### 4.6 Subscription flow

```
click "Turn on notifications"
  → Notification.requestPermission()
  → if granted:
      reg = await navigator.serviceWorker.ready
      vapid = data.appInfo.vapidPublicKey
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      })
      await subscribePush({ subscription: sub.toJSON() })
      toast.success('Notifications enabled')
  → if denied:
      toast.warning('Permission denied — enable in Settings')
```

`userVisibleOnly: true` is mandatory; iOS rejects silent push.

## 5. iOS / PWA specifics

- `public/manifest.json` is mostly fine; add `"scope": "/"` explicitly. `apple-touch-icon` already in `index.html`.
- iOS requires the PWA be launched from Home Screen for push to work at all. Detect via combined `matchMedia` + `navigator.standalone` check.
- iOS 16.4+ required. Version detection via UA parse — used only for friendlier messaging, never to gate subscribe (the browser fails correctly on its own).
- Every push **must** result in a visible notification (`userVisibleOnly: true`), or iOS revokes the subscription after a few violations.

## 6. Testing strategy

### Backend (CI-gated)

See §3.9.

### Frontend (not coverage-gated)

- **Jest**: `pushClient.ts` pure helpers (`urlBase64ToUint8Array`, `iosVersion()` with mocked UA, `isStandalonePWA()` with mocked `matchMedia`); `NotificationSettings.tsx` rendering per state with mocked `Notification` + `navigator.serviceWorker` globals.
- **Skip**: `public/sw.js` itself — jsdom can't simulate ServiceWorkerGlobalScope. Covered by manual smoke test.

### Manual iPhone test plan

1. Deploy to HTTPS staging.
2. iPhone iOS 16.4+: open in Safari → Share → Add to Home Screen → "MovieNight".
3. Open from Home Screen icon (not Safari).
4. Log in → open Notification Settings (navbar gear) → "Turn on notifications" → accept system prompt.
5. From a second device logged in as another user, add a movie.
6. Within ~5s, iPhone shows banner: `Alice added "Dune" to the queue`. Tap → opens app to `/`.
7. With PWA open, repeat — confirm in-app notification still fires.
8. Disable "New movies added by others" → repeat — confirm no notification.
9. Sign out, sign in as new user — confirm preferences are per-user.

Edge cases:

- Reboot phone, repeat — subscription survives.
- Reinstall PWA — old endpoint will 410 and be pruned; new subscribe works.
- Log out without unsubscribing — push still fires (subscription is per-device, not per-session). Decide if intentional.

## 7. Rollout

### Merge order

1. **HTTPS reverse proxy** (operator, no merge).
2. **Backend** — migrations + push module + resolvers + tests.
3. **VAPID env vars** set on production host.
4. **Frontend** — SW + NotificationSettings + Navbar entry point.

Steps 2 and 4 may ship in one PR — small risk if backend deploys before frontend (clients won't call the new mutations until users click the new button).

### Feature flag

Not needed — push degrades gracefully when VAPID env vars are unset (`vapidPublicKey: null` → UI shows "Notifications aren't configured on this server").

### Security

- Endpoint + auth keys are capability material — never log, never return from queries, never put in audit `metadata`.
- `unsubscribePush` scopes `DELETE` to `WHERE endpoint = $1 AND user_id = $2`. Returns `true` either way (prevents enumeration).
- Endpoint length cap (8 KB).
- Rate-limit `subscribePush` (reuse `checkRateLimit` in `resolvers.ts`): 20 / user / hour.
- Notification payloads contain only publicly-knowable info (movie title, requester display name). No emails, IPs, or secrets.

### iPhone-specific failure modes

- **PWA reinstall** invalidates the prior subscription. On every app launch, call `getCurrentSubscription()`; if null but user previously enabled, prompt to re-enable.
- **iOS quietly revokes permission** after ~30 days of disuse. Same re-subscribe flow handles it.
- **Low Power Mode** can coalesce / delay pushes by minutes. Don't promise instant delivery in UI copy.
- **Standalone requirement** is the biggest UX cliff. Plan to track conversion: "Turn on notifications" taps vs successful subscribes.

## 8. Out of scope

- SW caching strategy
- Other notification triggers (`markWatched`, connection requests). The `push.ts` API is generic — adding a new event is two lines + a whitelist entry.
- Notification grouping beyond the `tag` field
- Push for unauthenticated users

## Architectural trade-offs (summary)

| Decision                  | Chosen                              | Alternative                     | Why                                                         |
| ------------------------- | ----------------------------------- | ------------------------------- | ----------------------------------------------------------- |
| Pref storage              | Separate table                      | Boolean column on `users`       | Extensibility; matches `tags` pattern                       |
| Push delivery             | Fire-and-forget in resolver         | Awaited inline                  | Latency + reliability                                       |
| VAPID public key delivery | GraphQL `appInfo.vapidPublicKey`    | `REACT_APP_*` env var           | Rotation without rebuild                                    |
| Subscription identity     | `UNIQUE(endpoint)`                  | `(user_id, endpoint)` composite | Endpoints are globally unique by spec                       |
| SW caching                | None (push only)                    | Workbox / CRA default           | Polling app; would conflict with nginx HTML cache rules     |
| SW gate                   | Production-only                     | Always-on incl. localhost       | Avoids stale-SW dev pain; matches `isProduction` convention |
| Settings UI               | New modal from navbar gear icon     | Tab in OnboardingGuide          | OnboardingGuide is for learning, not configuring            |
| Failure pruning           | Immediate on 404/410; 5xx threshold | Always-immediate                | Tolerate transient push-service outages                     |
