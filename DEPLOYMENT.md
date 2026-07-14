# MovieNight Deployment Guide

Automated deployment to the nova homelab via GitHub Actions and a self-hosted
runner. No inbound SSH; the runner long-polls GitHub from inside nova and
executes `docker compose` locally against the shared socket proxy.

## Architecture

- **Application:** React 18 + TypeScript (frontend) + Node/GraphQL (backend)
- **Container Registry:** GitHub Container Registry (GHCR)
- **Deployment target:** nova homelab, orchestrated by `nova-config`
- **Deploy runner:** `runner-movienight` container in the `infra` stack of
  `nova-config`. Registers to this repo with labels
  `nova,movienight,movienight-test` and picks up jobs pinned to those labels.
  See `nova-config/context/runners.md`.

## CI/CD Pipeline

### Production (`.github/workflows/deploy.yml`)

- **Trigger:** push to `master`, or manual `workflow_dispatch`
- **Build/push jobs** (`ubuntu-latest`): build the frontend + backend images
  and push `:latest` to GHCR.
- **Deploy job** (`[self-hosted, nova, movienight]`): from inside nova, run
  `docker compose -f $COMPOSE_FILE pull && up -d` against
  `movienight/compose.yaml` and verify the three services
  (`movienight-frontend`, `movienight-backend`, `movienight-db`) are running.

### PR test (`.github/workflows/deploy-test.yml`)

- **Trigger:** pull requests (opened/synced/reopened/ready) or manual dispatch
- Builds `:test` images and deploys to the `movienight-test` stack via the
  same runner. Fork-PR guard on both jobs — deploy only runs when the PR
  originates from a branch in this repo.

### Test build (`.github/workflows/test-build.yml`)

- **Trigger:** push to `dev`, PRs to `dev`
- Builds the Docker image to verify compilation. Does not push or deploy.

## Prerequisites (one-time per repo)

The runner and socket proxy are provisioned in `nova-config` — see
`nova-config/context/runners.md`. This repo only needs the following
GitHub repository configuration:

### Repository variables (`Settings → Secrets and variables → Actions → Variables`)

| Variable | Value | Purpose |
| --- | --- | --- |
| `NOVA_CONFIG_PATH` | `/nova-config` | In-container mount path of the read-only nova-config checkout inside the runner. |
| `COMPOSE_FILE_PROD` | `movienight/compose.yaml` | Path (relative to `NOVA_CONFIG_PATH`) of the production compose file. |
| `COMPOSE_FILE_TEST` | `movienight-test/compose.yaml` | Path (relative to `NOVA_CONFIG_PATH`) of the PR-test compose file. |

### Secrets

No repo-scoped secrets are required for deploy. The runner authenticates to
GHCR with the workflow-provided `GITHUB_TOKEN`. Runtime app secrets
(`MOVIENIGHT_JWT_SECRET`, DB password, SMTP creds, etc.) live in
`nova-config/.env` and are already wired into the compose file.

### Runner registration

Ensure the `runner-movienight` container in `nova-config/infra/compose.yaml`
is running and shows **Idle** under
`Settings → Actions → Runners`. The runner registers to this repo with the
`nova`, `movienight`, and `movienight-test` labels.

## Triggering a Deployment

- **Automatic (prod):** merge a PR to `master`.
- **Automatic (test):** open or push a PR against `master`. Deploys to
  `movienight-test.${NOVA_DOMAIN}`.
- **Manual:** `Actions → Deploy to Nova → Run workflow`.

## Monitoring Deployment

- GitHub Actions run: **Actions** tab → workflow run → expand jobs.
- Container status: on nova, `docker ps --filter name=movienight`.
- Logs: `docker logs movienight-frontend|movienight-backend|movienight-db`
  (or via Dockge / Arcane).

## Rollback

The deploy job pulls and starts `:latest`. To roll back, revert the code
change on `master` and let the next deploy replace the images. For an
emergency in-place rollback:

```bash
# On nova
cd /srv/nova-config
docker compose -f movienight/compose.yaml pull \
  movienight-frontend:<previous-sha-tag> \
  movienight-backend:<previous-sha-tag>
docker compose -f movienight/compose.yaml up -d
```

Previous tags are available in GHCR under
`ghcr.io/nova-firefly/movienight` and
`ghcr.io/nova-firefly/movienight-backend`.

## Troubleshooting

### A deploy job sits Queued forever

The runner is Offline. On nova:

```bash
docker ps --filter name=runner-movienight
docker logs --tail 100 runner-movienight
```

See `nova-config/context/runners.md#troubleshooting`.

### Deploy fails at `docker compose pull` (denied)

The workflow's `GITHUB_TOKEN` no longer has package read scope, or the
image was published under a different owner. Verify the workflow
`permissions:` block includes `packages: read`.

### Deploy fails at build stage

Same as any GH-hosted build failure — inspect the Actions logs for the
frontend/backend build job.

### Container fails to start

```bash
docker logs movienight-backend
```

Common causes: env var missing from `nova-config/.env`, DB migration
failure, or port collision with another Traefik router.

## Local Testing

Before pushing to master, verify the Docker build locally:

```bash
docker build -t movienight:test .
docker run -d --name movienight-test -p 9000:80 movienight:test
open http://localhost:9000/movienight/
docker stop movienight-test && docker rm movienight-test
```

## See also

- `nova-config/context/runners.md` — self-hosted runner architecture and
  troubleshooting.
- `nova-config/movienight/compose.yaml` — production stack definition.
- `nova-config/movienight-test/compose.yaml` — PR-test stack definition.
