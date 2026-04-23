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

## Run the full local stack

Use this mode when you need REST API, WebSocket signaling, SFU, TURN, and nginx gateway together:

```bash
cd deploy
cp .env.example .env
docker compose up -d --build
```

Open:

```text
http://localhost:8023
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
cd deploy
docker compose ps
docker compose logs --tail=100 nginx backend web turn
```

If nginx returns `502`, first check whether backend is healthy:

```bash
curl -I http://127.0.0.1:8023/healthz
```
