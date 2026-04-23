# Локальная разработка

Эта страница описывает, как запускать проект локально.

## Установка зависимостей

Из корня репозитория:

```bash
npm install
npm --prefix app install
```

Root install нужен для repository-level tools вроде Prettier. `app` install нужен для webapp
workspace, KVT packages и VitePress docs.

## Запуск только webapp

Используй этот режим для UI-разработки, когда не нужна локальная Docker media-инфраструктура:

```bash
npm run dev
```

Команда запускает `app/webapp` через Vite.

## Запуск всего локального стека

Используй этот режим, когда нужны REST API, WebSocket signaling, SFU, TURN и nginx gateway вместе:

```bash
cd deploy
cp .env.example .env
docker compose up -d --build
```

Открыть:

```text
http://localhost:8023
```

## Проверка медиа локально

Для WebRTC media testing важны browser security rules:

- `localhost` считается secure context.
- LAN IP может требовать HTTPS в зависимости от браузера и устройства.
- Если тестируешь с телефона, `PUBLIC_BASE_URL`, `ICE_PUBLIC_IP`, `TURN_URL` и `TURN_EXTERNAL_IP`
  должны указывать на адрес, доступный с телефона.

## Частые команды

```bash
npm run lint
npm run build
npm run test:backend
npm run docs:dev
```

## Backend docs локально

Когда Docker Compose запущен:

```text
http://localhost:8023/api/swagger
http://localhost:8023/api/openapi.json
http://localhost:8023/healthz
```

## Debug compose

```bash
cd deploy
docker compose ps
docker compose logs --tail=100 nginx backend web turn
```

Если nginx отдаёт `502`, сначала проверь backend health:

```bash
curl -I http://127.0.0.1:8023/healthz
```
