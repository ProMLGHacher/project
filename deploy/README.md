# Deploy Contours

This directory contains both Docker contours for the project.

- `docker-compose.yml` - production-like contour.
- `docker-compose.dev.yml` - development override with hot reload.
- `.env` - server / production-like environment.
- `.env.dev` - ready-to-run localhost development environment.

## Services

- `nginx` - the only host-exposed gateway, published on `8023`.
- `backend` - Go API, signaling, and SFU process, internal-only in the Docker network.
- `web` - production static build in prod contour, Vite dev server in dev contour.
- `turn` - coturn for browser relay traffic.

## Run development contour

```bash
npm run stack:dev
```

Open the app at [http://localhost:8023](http://localhost:8023).

## Run production-like contour

```bash
npm run stack:prod
```

## Stop

```bash
npm run stack:dev:down
npm run stack:prod:down
```

## Environment files

- `.env.dev` is tuned for localhost development on this machine.
- `.env` remains the server-oriented environment file.
- For LAN phone testing, start from `.env.dev` and replace host/IP values with your LAN address.

## Notes

- `nginx` remains the only HTTP entrypoint on the host.
- In dev, nginx proxies `/` to Vite on port `5173`, so frontend changes reload without rebuilding.
- For local WebRTC media checks, the stack also publishes backend UDP ICE ports and TURN relay ports. Without those extra ports, local audio/video validation would not be realistic.
- The frontend uses same-origin requests through `nginx`, so `/api` and `/ws` are reverse-proxied to the backend.
- The TURN service is configured for local development and should be replaced with real certificates and a public `external-ip` in production.
- The backend is single-node and in-memory by design for v1.
