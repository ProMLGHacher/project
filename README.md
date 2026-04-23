# Voice-First SFU Conference

Greenfield workspace for a voice-first WebRTC SFU conference product.

The repository contains three main parts:

- `app/webapp` - React + TypeScript product client.
- `app/kvt` - local KVT framework packages used by the client.
- `backend` - Go + Pion SFU, signaling, room management, REST API, Swagger/OpenAPI.
- `deploy` - Docker Compose infrastructure with nginx gateway, backend, web, and TURN.

## Start Here

Install dependencies from the repository root:

```bash
npm install
npm --prefix app install
```

Run the main checks before pushing:

```bash
npm run lint
npm run build
```

Run the full local stack:

```bash
cd deploy
docker compose up -d --build
```

Open the app through the gateway:

```text
http://localhost:8023
```

The gateway is intentional: backend, web, and TURN live in the Docker network; only nginx is exposed
for HTTP on port `8023`.

## Root Commands

These commands are defined in the root `package.json`.

| Command                | Purpose                                                     |
| ---------------------- | ----------------------------------------------------------- |
| `npm run dev`          | Start the new `app/webapp` Vite dev server.                 |
| `npm run build`        | Build the app workspace, including KVT packages and webapp. |
| `npm run lint`         | Run webapp ESLint and all Go backend tests.                 |
| `npm run test`         | Alias for `npm run lint`.                                   |
| `npm run test:backend` | Run only backend Go tests.                                  |
| `npm run format`       | Format the repository with Prettier and `gofmt`.            |
| `npm run format:check` | Check formatting without writing changes.                   |
| `npm run docs:dev`     | Start VitePress documentation locally.                      |
| `npm run docs:build`   | Build documentation.                                        |
| `npm run docs:preview` | Preview built documentation.                                |

## Documentation

Run docs locally:

```bash
npm run docs:dev
```

The docs are split into two tracks:

- `KVT` - framework documentation for `@kvt/core`, `@kvt/react`, and `@kvt/theme`.
- `Webapp` - onboarding documentation for product developers: architecture, conventions, design
  system, i18n, and adaptive layouts.

Useful entry points:

- `http://localhost:5173/kvt/guide/`
- `http://localhost:5173/webapp/`
- `http://localhost:5173/ru/kvt/guide/`
- `http://localhost:5173/ru/webapp/`

## Backend Documentation

When the stack is running through Docker Compose:

```text
http://localhost:8023/api/swagger
http://localhost:8023/api/openapi.json
http://localhost:8023/healthz
```

On production:

```text
https://kvt.araik.dev/api/swagger
https://kvt.araik.dev/api/openapi.json
https://kvt.araik.dev/healthz
```

Swagger documents the REST endpoints and WebSocket signaling message schemas.

## Project Architecture

The webapp follows feature-oriented clean architecture:

```text
app/webapp/src/
  app/           bootstrap, router, DI composition
  core/          app technical layer and product design system
  capabilities/  reusable product subsystems
  features/      user-facing flows and screens
```

KVT provides framework primitives:

- DI container and modules.
- ViewModel lifecycle.
- Flow, StateFlow, SharedFlow.
- React adapter hooks.
- Route-aware lazy feature loading.
- Theme provider and tokens.

The product app owns product-specific rules:

- feature boundaries;
- room/prejoin/home flows;
- design system;
- i18n resources;
- RTC/media capability implementations.

## Development Rules

- Use `app/webapp` only; the old root `web` client was removed.
- Do not construct repositories or use cases inside React components.
- Views render state and send actions to ViewModels.
- ViewModels expose read-only `StateFlow` and emit one-off `SharedFlow` effects.
- User-visible feedback should use the app-wide toast manager, not `console.info`.
- UI state and effects should store typed translation keys, not arbitrary strings.
- Use design-system tokens and components instead of hard-coded visual values.
- Keep backend services internal to Docker; route public HTTP traffic through nginx.

## Deployment Notes

Production currently serves the app through an external proxy to local gateway port `8023`.

Server update flow:

```bash
cd ~/plakat
git pull
cd deploy
docker compose build web backend
docker compose up -d --force-recreate web backend nginx
```

Use backend rebuild only when Go code changed. For frontend-only changes, rebuilding `web` and
recreating `nginx` is enough.

## Troubleshooting

If the app returns `502`, check the gateway and backend health:

```bash
cd deploy
docker compose ps
docker compose logs --tail=100 nginx backend web
curl -I http://127.0.0.1:8023/healthz
```

If WebRTC works on one network but not another, check TURN and ICE-related environment variables in
`deploy/.env`, then inspect backend and exported client logs.
