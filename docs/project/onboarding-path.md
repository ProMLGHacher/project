# Onboarding Path

This page gives a practical onboarding route for new engineers.

## 30 minutes: system orientation

1. Read repository overview in root `README.md`.
2. Read [Project Overview](./overview.md).
3. Read [Service Interactions](./service-interactions.md).
4. Scan `deploy/README.md` to understand runtime topology.

Outcome: you can explain product boundaries and request/media flows.

## 60 minutes: codebase orientation

1. Read webapp architecture: [Webapp Architecture](../webapp/architecture.md).
2. Read backend architecture: [Backend Overview](../backend/index.md).
3. Open these paths and map responsibilities:
   - `app/webapp/src/app`
   - `app/webapp/src/features`
   - `app/webapp/src/capabilities`
   - `backend/internal/application`
   - `backend/internal/adapters`

Outcome: you can point to ownership for UI logic, domain use cases, and adapters.

## 120 minutes: run and verify locally

1. Install dependencies:
   - `npm install`
   - `npm --prefix app install`
2. Start webapp-only dev:
   - `npm run dev`
3. Start full stack (if validating E2E media):
   - `cd deploy`
   - `docker compose up -d --build`
4. Validate docs and health:
   - `npm run docs:dev`
   - `curl -I http://localhost:8023/healthz`

Outcome: you can run the product and locate logs for first-line troubleshooting.

## New engineer checklist

- Understands feature vs capability boundaries.
- Understands REST + WS signaling vs WebRTC media split.
- Knows why nginx is the single HTTP entrypoint.
- Knows where room/session state is persisted in v1 (in-memory backend runtime).
- Knows where to look first when join/media fails.
