# Backend

The backend is a Go service built around Pion WebRTC.

Responsibilities:

- room lifecycle;
- participant sessions;
- REST API;
- WebSocket signaling;
- SFU publisher/subscriber orchestration;
- OpenAPI/Swagger documentation;
- health checks.

## Source layout

```text
backend/
  cmd/server/                 process entrypoint
  internal/config/            environment loading
  internal/domain/            room and media domain models
  internal/application/       use cases and coordinators
  internal/adapters/http/     REST, Swagger, OpenAPI
  internal/adapters/media/    Pion SFU adapter
  internal/adapters/signaling WebSocket hub
  internal/adapters/repository in-memory repositories
  internal/protocol/          signaling message contracts
```

## Local commands

From repository root:

```bash
npm run test:backend
```

Or directly:

```bash
cd backend
go test ./...
go run ./cmd/server
```

Direct `go run` is useful for backend-only work, but full WebRTC testing is easier through Docker
Compose because it also starts nginx and TURN.

## API docs

With the stack running:

```text
http://localhost:8023/api/swagger
http://localhost:8023/api/openapi.json
```

Swagger documents:

- REST endpoints;
- WebSocket endpoint;
- client-to-server signaling messages;
- server-to-client signaling messages.

## Health check

```text
GET /healthz
```

Through local gateway:

```bash
curl -I http://localhost:8023/healthz
```

Inside Docker network, nginx checks backend directly:

```text
http://backend:8080/healthz
```

## Runtime model

The current runtime is single-node and in-memory.

That means:

- rooms disappear after backend restart;
- participant sessions disappear after backend restart;
- repositories are structured so Redis/Postgres can be added later, but v1 does not require them.

Room-not-found states must be handled by UI because a refresh after restart can point to a room that
no longer exists.

## WebRTC topology

The client uses:

- one publisher PeerConnection for local audio/camera/screen;
- one subscriber PeerConnection for all remote room media.

The backend SFU keeps stable media slots:

- `audio`;
- `camera`;
- `screen`.

This is designed so camera/screen changes can renegotiate without dropping the audio path.

## Logs

Backend logs are available through Docker:

```bash
cd deploy
docker compose logs --tail=200 backend
```

For WebRTC issues, collect both:

- backend logs;
- exported client logs from the UI.
