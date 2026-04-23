# Production Deploy

This page describes the deployment shape without real production credentials.

## Runtime shape

Production should expose only the gateway HTTP port.

```text
internet / external proxy
  -> nginx gateway on host port 8023
    -> web container
    -> backend container
    -> turn container
```

The backend and web services are internal to the Docker network. Public HTTP traffic should go
through nginx.

## Server prerequisites

Install on the server:

- Git.
- Docker.
- Docker Compose plugin.
- Access to the repository.
- DNS or external reverse proxy pointing to the gateway port.

## First deploy

```bash
cd <deploy-parent-dir>
git clone <repo-url> <project-dir>
cd <project-dir>/deploy
cp .env.example .env
```

Edit `.env` for the server. See [Environment Variables](./environment.md).

Start:

```bash
docker compose up -d --build
```

Check:

```bash
docker compose ps
curl -I http://127.0.0.1:8023/healthz
```

## Updating production

From the project directory:

```bash
git pull
cd deploy
docker compose build web backend
docker compose up -d --force-recreate web backend nginx
```

If only frontend changed:

```bash
cd deploy
docker compose build web
docker compose up -d --force-recreate web nginx
```

If only backend changed:

```bash
cd deploy
docker compose build backend
docker compose up -d --force-recreate backend nginx
```

## External HTTPS proxy

If another reverse proxy terminates HTTPS before this compose stack, it should forward traffic to:

```text
http://127.0.0.1:8023
```

It must preserve:

- `Host`;
- `X-Forwarded-Host`;
- `X-Forwarded-Proto`;
- WebSocket upgrade headers for `/ws`.

The app creates secure WebSocket URLs from `window.location.protocol`, so HTTPS pages must connect
through `wss://`.

## Operations checks

```bash
cd deploy
docker compose ps
docker compose logs --tail=100 nginx backend web turn
curl -I http://127.0.0.1:8023/
curl -I http://127.0.0.1:8023/healthz
```

## Important notes

- Do not commit real `.env` production secrets.
- Keep TURN credentials strong.
- Keep `PUBLIC_BASE_URL` aligned with the public URL users open in the browser.
- Keep `ICE_PUBLIC_IP` and `TURN_EXTERNAL_IP` reachable from clients.
- For reliable WebRTC across VPNs and strict NATs, TURN must be reachable over UDP and TCP/TLS
  fallback.
