# Production deploy

Эта страница описывает deployment без реальных production credentials.

## Runtime shape

В production наружу должен смотреть только gateway HTTP port.

```text
internet / external proxy
  -> nginx gateway on host port 8023
    -> web container
    -> backend container
    -> turn container
```

Backend и web services остаются внутри Docker network. Public HTTP traffic должен идти через nginx.

## Требования к серверу

На сервере нужны:

- Git.
- Docker.
- Docker Compose plugin.
- Доступ к репозиторию.
- DNS или external reverse proxy, который проксирует на gateway port.

## Первый deploy

```bash
cd <deploy-parent-dir>
git clone <repo-url> <project-dir>
cd <project-dir>/deploy
cp .env.example .env
```

Заполни `.env` под сервер. Смотри [Environment Variables](./environment.md).

Запуск:

```bash
docker compose up -d --build
```

Проверка:

```bash
docker compose ps
curl -I http://127.0.0.1:8023/healthz
```

## Обновление production

Из директории проекта:

```bash
git pull
cd deploy
docker compose build web backend
docker compose up -d --force-recreate web backend nginx
```

Если менялся только frontend:

```bash
cd deploy
docker compose build web
docker compose up -d --force-recreate web nginx
```

Если менялся только backend:

```bash
cd deploy
docker compose build backend
docker compose up -d --force-recreate backend nginx
```

## External HTTPS proxy

Если HTTPS завершается внешним reverse proxy перед compose stack, он должен проксировать на:

```text
http://127.0.0.1:8023
```

Важно сохранять:

- `Host`;
- `X-Forwarded-Host`;
- `X-Forwarded-Proto`;
- WebSocket upgrade headers для `/ws`.

App создаёт secure WebSocket URL из `window.location.protocol`, поэтому HTTPS pages должны
подключаться через `wss://`.

## Operations checks

```bash
cd deploy
docker compose ps
docker compose logs --tail=100 nginx backend web turn
curl -I http://127.0.0.1:8023/
curl -I http://127.0.0.1:8023/healthz
```

## Важные заметки

- Не коммить реальные `.env` production secrets.
- TURN credentials должны быть сильными.
- `PUBLIC_BASE_URL` должен совпадать с public URL, который открывают пользователи.
- `ICE_PUBLIC_IP` и `TURN_EXTERNAL_IP` должны быть доступны клиентам.
- Для WebRTC через VPN и strict NAT нужен доступный TURN по UDP и TCP/TLS fallback.
