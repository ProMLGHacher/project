# Local Development

This page explains how to run the project locally.

## Install dependencies

From repository root:

```bash
npm install
npm --prefix app install
```

The root install is used for repository-level tools such as Prettier. The `app` install is used for
the webapp workspace, KVT packages, and VitePress docs.

## Run webapp only

Use this mode for UI work when you do not need local Docker media infrastructure:

```bash
npm run dev
```

The command starts `app/webapp` through Vite.

## Run the development contour

Use this mode when you need REST API, WebSocket signaling, SFU, TURN, nginx gateway, and frontend
hot reload together:

```bash
npm run stack:dev
```

Open:

```text
http://localhost:8023
```

The dev contour uses:

- `deploy/docker-compose.yml` as the shared base;
- `deploy/docker-compose.dev.yml` as the development override;
- `deploy/.env.dev` as the ready-to-run localhost environment.

Stop it with:

```bash
npm run stack:dev:down
```

Inspect the merged compose config with:

```bash
npm run stack:dev:config
```

## Run the production-like contour

Use this mode when you want to validate the built frontend exactly as the server serves it:

```bash
npm run stack:prod
```

Stop it with:

```bash
npm run stack:prod:down
```

## Local media checks

For WebRTC media testing, browser security rules matter:

- `localhost` is treated as a secure context by browsers.
- LAN IPs may require HTTPS depending on browser and device.
- If testing from a phone, `PUBLIC_BASE_URL`, `ICE_PUBLIC_IP`, `TURN_URL`, and `TURN_EXTERNAL_IP`
  must point to an address reachable from that phone.

## Common commands

```bash
npm run lint
npm run build
npm run test:backend
npm run docs:dev
```

## Local backend docs

With Docker Compose running:

```text
http://localhost:8023/api/swagger
http://localhost:8023/api/openapi.json
http://localhost:8023/healthz
```

## Debugging local compose

```bash
npm run stack:dev:logs
```

If nginx returns `502`, first check whether backend is healthy:

```bash
curl -I http://127.0.0.1:8023/healthz
```
