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

## Запуск dev-контура

Используй этот режим, когда нужны REST API, WebSocket signaling, SFU, TURN, nginx gateway и hot
reload фронта вместе:

```bash
npm run stack:dev
```

Открыть:

```text
http://localhost:8023
```

Dev-контур использует:

- `deploy/docker-compose.yml` как общую базу;
- `deploy/docker-compose.dev.yml` как dev override;
- `deploy/.env.dev` как готовое localhost-окружение.

Остановить:

```bash
npm run stack:dev:down
```

Посмотреть итоговую Compose-конфигурацию:

```bash
npm run stack:dev:config
```

## Запуск production-like контура

Используй этот режим, когда нужно проверить именно собранный фронт так, как он будет жить на
сервере:

```bash
npm run stack:prod
```

Остановить:

```bash
npm run stack:prod:down
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
npm run stack:dev:logs
```

Если nginx отдаёт `502`, сначала проверь backend health:

```bash
curl -I http://127.0.0.1:8023/healthz
```
