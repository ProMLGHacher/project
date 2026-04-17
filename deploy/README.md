# Local Deploy

This directory contains the local infrastructure needed for the first end-to-end environment.

## Services

- `nginx` - the only host-exposed gateway, published on `8023`.
- `backend` - Go API, signaling, and SFU process, internal-only in the Docker network.
- `web` - Vite dev server for the React client, internal-only in the Docker network.
- `turn` - coturn for browser relay traffic.

## Run

```bash
cd /Users/araik/Documents/codex-webrtc/project/deploy
docker compose up --build
```

Open the app at [http://localhost:8023](http://localhost:8023).
For your current LAN, the generated `.env` uses `http://192.168.1.248:8023`.

## Notes

- `nginx` remains the only HTTP entrypoint on the host.
- For local WebRTC media checks, the stack also publishes backend UDP ICE ports and TURN relay ports. Without those extra ports, local audio/video validation would not be realistic.
- The frontend uses same-origin requests through `nginx`, so `/api` and `/ws` are reverse-proxied to the backend.
- The TURN service is configured for local development and should be replaced with real certificates and a public `external-ip` in production.
- The backend is single-node and in-memory by design for v1.
