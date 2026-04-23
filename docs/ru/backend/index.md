# Backend

Backend — Go service на Pion WebRTC.

Ответственности:

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

## Локальные команды

Из корня репозитория:

```bash
npm run test:backend
```

Или напрямую:

```bash
cd backend
go test ./...
go run ./cmd/server
```

`go run` полезен для backend-only работы, но полный WebRTC testing проще через Docker Compose,
потому что он также запускает nginx и TURN.

## API docs

Когда stack запущен:

```text
http://localhost:8023/api/swagger
http://localhost:8023/api/openapi.json
```

Swagger описывает:

- REST endpoints;
- WebSocket endpoint;
- client-to-server signaling messages;
- server-to-client signaling messages.

## Health check

```text
GET /healthz
```

Через local gateway:

```bash
curl -I http://localhost:8023/healthz
```

Внутри Docker network nginx проверяет backend напрямую:

```text
http://backend:8080/healthz
```

## Runtime model

Текущий runtime single-node и in-memory.

Это значит:

- rooms исчезают после backend restart;
- participant sessions исчезают после backend restart;
- repositories структурированы так, чтобы позже добавить Redis/Postgres, но v1 этого не требует.

UI обязан обрабатывать room-not-found, потому что refresh после restart может указывать на комнату,
которой уже нет.

## WebRTC topology

Client использует:

- один publisher PeerConnection для local audio/camera/screen;
- один subscriber PeerConnection для всех remote room media.

Backend SFU держит stable media slots:

- `audio`;
- `camera`;
- `screen`.

Это нужно, чтобы camera/screen changes могли renegotiate без разрыва audio path.

## Logs

Backend logs доступны через Docker:

```bash
cd deploy
docker compose logs --tail=200 backend
```

Для WebRTC issues собирай вместе:

- backend logs;
- exported client logs из UI.
