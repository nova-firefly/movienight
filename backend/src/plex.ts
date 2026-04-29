import crypto from 'crypto';

const PLEX_API_BASE = 'https://plex.tv/api/v2';

// Stable client ID — must be consistent across restarts for Plex to recognise the app.
const PLEX_CLIENT_ID = process.env.PLEX_CLIENT_ID || `movienight-${crypto.randomUUID()}`;

export interface PlexPin {
  id: number;
  code: string;
  authToken: string | null;
}

export interface PlexUser {
  id: number;
  uuid: string;
  username: string;
  email: string;
  thumb: string;
}

export function getPlexClientId(): string {
  return PLEX_CLIENT_ID;
}

export function getPlexAuthUrl(code: string): string {
  const params = new URLSearchParams({
    clientID: PLEX_CLIENT_ID,
    code,
    'context[device][product]': 'MovieNight',
  });
  return `https://app.plex.tv/auth#?${params.toString()}`;
}

export async function createPlexPin(): Promise<PlexPin> {
  const response = await fetch(`${PLEX_API_BASE}/pins`, {
    method: 'POST',
    headers: {
      'X-Plex-Client-Identifier': PLEX_CLIENT_ID,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'strong=true',
  });
  if (!response.ok) {
    throw new Error(`Plex PIN creation failed: ${response.status}`);
  }
  return response.json() as Promise<PlexPin>;
}

export async function checkPlexPin(pinId: number): Promise<PlexPin> {
  const response = await fetch(`${PLEX_API_BASE}/pins/${pinId}`, {
    headers: {
      'X-Plex-Client-Identifier': PLEX_CLIENT_ID,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`Plex PIN check failed: ${response.status}`);
  }
  return response.json() as Promise<PlexPin>;
}

export async function getPlexUser(authToken: string): Promise<PlexUser> {
  const response = await fetch(`${PLEX_API_BASE}/user`, {
    headers: {
      'X-Plex-Token': authToken,
      'X-Plex-Client-Identifier': PLEX_CLIENT_ID,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`Plex user fetch failed: ${response.status}`);
  }
  return response.json() as Promise<PlexUser>;
}

export async function waitForPlexAuth(
  pinId: number,
  timeoutMs = 120_000,
  intervalMs = 2_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const pin = await checkPlexPin(pinId);
    if (pin.authToken) return pin.authToken;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Plex authentication timed out');
}
