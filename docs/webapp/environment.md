# Environment Variables

Environment variables are configured per contour:

- `deploy/.env.dev` - ready-to-run localhost development.
- `deploy/.env` - production/server environment.

For development, you usually do not need to create anything manually because `deploy/.env.dev` is
already prepared.

For production/server setup, start from:

```bash
cd deploy
cp .env.example .env
```

Do not commit real production values.

## Gateway

| Variable          | Example               | Description                                                                                         |
| ----------------- | --------------------- | --------------------------------------------------------------------------------------------------- |
| `GATEWAY_PORT`    | `8023`                | Host port published by nginx gateway. External proxies should forward HTTP traffic here.            |
| `PUBLIC_BASE_URL` | `https://example.com` | Public URL used by backend when it needs to build room links. Use the exact browser-facing origin.  |
| `PUBLIC_HOST`     | `example.com`         | Human-readable host value used by deploy scripts/config conventions. Keep aligned with public host. |

## Backend HTTP

| Variable        | Example      | Description                                                                        |
| --------------- | ------------ | ---------------------------------------------------------------------------------- |
| `HTTP_ADDR`     | `:8080`      | Address used by backend inside the Docker network. Usually do not change.          |
| `INVITE_SECRET` | `replace-me` | HMAC secret for signed invite/session-related data. Use a strong production value. |

## SFU ICE

| Variable           | Example        | Description                                                                      |
| ------------------ | -------------- | -------------------------------------------------------------------------------- |
| `ICE_PUBLIC_IP`    | `203.0.113.10` | Public IP announced by the SFU for ICE candidates. Must be reachable by clients. |
| `ICE_UDP_PORT_MIN` | `50000`        | First UDP port exposed for backend WebRTC media.                                 |
| `ICE_UDP_PORT_MAX` | `50100`        | Last UDP port exposed for backend WebRTC media.                                  |

The port range must match Docker Compose published ports and any firewall rules.

## TURN

| Variable              | Example                                | Description                                     |
| --------------------- | -------------------------------------- | ----------------------------------------------- |
| `TURN_URL`            | `turn:203.0.113.10:3478?transport=udp` | TURN URL sent to clients for UDP relay.         |
| `TURN_TLS_URL`        | `turns:example.com:5349?transport=tcp` | TURN TLS/TCP fallback URL sent to clients.      |
| `TURN_USERNAME`       | `voice`                                | TURN username sent to clients.                  |
| `TURN_PASSWORD`       | `replace-me`                           | TURN credential. Use a strong production value. |
| `TURN_REALM`          | `voice.example.com`                    | coturn realm. Usually the product domain.       |
| `TURN_EXTERNAL_IP`    | `203.0.113.10`                         | Public IP coturn advertises to clients.         |
| `TURN_PORT`           | `3478`                                 | Host port for TURN UDP/TCP.                     |
| `TURN_TLS_PORT`       | `5349`                                 | Host port for TURN TLS/TCP fallback.            |
| `TURN_RELAY_PORT_MIN` | `49160`                                | First TURN relay UDP port.                      |
| `TURN_RELAY_PORT_MAX` | `49200`                                | Last TURN relay UDP port.                       |

For production, firewall rules must allow:

- gateway TCP port, usually behind an external HTTPS proxy;
- TURN UDP/TCP port;
- TURN TLS/TCP port;
- TURN relay UDP range;
- backend ICE UDP range.

## Frontend build

| Variable                | Example                           | Description                                                                           |
| ----------------------- | --------------------------------- | ------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`     | empty                             | Usually empty because nginx serves frontend and proxies `/api` and `/ws` same-origin. |
| `VITE_ALLOWED_HOSTS`    | `localhost,127.0.0.1,example.com` | Hosts allowed by Vite dev server. Used for local development.                         |
| `VITE_API_PROXY_TARGET` | `http://localhost:8023`           | Target used by Vite when the frontend is run directly in dev mode outside nginx.      |

Production Docker builds serve static files through nginx, so runtime API access should stay
same-origin.

## Local network setup

For local phone testing over LAN, replace host/IP values with your machine's LAN address:

```text
PUBLIC_BASE_URL=http://192.168.1.10:8023
ICE_PUBLIC_IP=192.168.1.10
TURN_URL=turn:192.168.1.10:3478?transport=udp
TURN_TLS_URL=turns:192.168.1.10:5349?transport=tcp
TURN_EXTERNAL_IP=192.168.1.10
```

Browsers may restrict camera/microphone on non-HTTPS origins outside `localhost`. For real remote
testing, prefer an HTTPS domain.
