# Voice-First SFU Conference

Монорепозиторий голосового WebRTC-продукта на SFU-архитектуре.

Если ты новый разработчик, начни с документации: там собрана вся основная информация по архитектуре,
запуску, правилам разработки и взаимодействию сервисов.

## С чего начать в первый день

1. Установи зависимости:

   ```bash
   npm install
   npm --prefix app install
   ```

2. Подними документацию:

   ```bash
   npm run docs:dev
   ```

3. Открой `http://localhost:5173` и пройди разделы в таком порядке:
   - `Project` - обзор продукта, архитектура, взаимодействия сервисов, маршрут онбординга.
   - `KVT` - framework-уровень (`@kvt/core`, `@kvt/react`, `@kvt/theme`).
   - `Webapp` - frontend-практики, архитектура, UI, i18n, deploy-аспекты приложения.
   - `Backend` - API/signaling/SFU, runtime-модель, health и диагностика.

## Структура репозитория

- `app/webapp` - продуктовый React + TypeScript клиент.
- `app/kvt` - локальные KVT framework packages.
- `backend` - Go backend (REST API, signaling, SFU, room/session).
- `deploy` - Docker Compose инфраструктура (nginx gateway, backend, web, TURN).
- `docs` - основная двуязычная документация проекта (EN/RU).

## Запуск проекта

### Только frontend (быстро для UI-задач)

```bash
npm run dev
```

### Полный стек (E2E с backend + TURN)

```bash
cd deploy
docker compose up -d --build
```

Приложение будет доступно через gateway:

`http://localhost:8023`

## Основные команды (из корня)

| Команда                | Назначение                              |
| ---------------------- | --------------------------------------- |
| `npm run dev`          | Запуск webapp в dev-режиме.             |
| `npm run build`        | Сборка workspace (`app`).               |
| `npm run lint`         | ESLint для webapp + Go tests backend.   |
| `npm run test:backend` | Только backend тесты (`go test ./...`). |
| `npm run format`       | Форматирование Prettier + `gofmt`.      |
| `npm run docs:dev`     | Локальный запуск документации.          |
| `npm run docs:build`   | Сборка документации.                    |
| `npm run docs:preview` | Просмотр собранной документации.        |

## Backend endpoints (локально)

Когда поднят `deploy`-стек:

- Swagger UI: `http://localhost:8023/api/swagger`
- OpenAPI JSON: `http://localhost:8023/api/openapi.json`
- Healthcheck: `http://localhost:8023/healthz`

## Если что-то не работает

Быстрая проверка при `502`/недоступности API:

```bash
cd deploy
docker compose ps
docker compose logs --tail=100 nginx backend web
curl -I http://127.0.0.1:8023/healthz
```
