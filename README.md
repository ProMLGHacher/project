# Voice-First SFU Conference

Рабочее пространство для voice-first WebRTC SFU конференций.

## Что лежит в репозитории

- `app/webapp` - продуктовый React + TypeScript клиент.
- `app/kvt` - локальные KVT framework packages, которые использует клиент.
- `backend` - Go + Pion SFU, signaling, room management, REST API, Swagger/OpenAPI.
- `deploy` - Docker Compose инфраструктура: nginx gateway, backend, web, TURN.

## Быстрый старт

Установить зависимости:

```bash
npm install
npm --prefix app install
```

Запустить локальную разработку webapp:

```bash
npm run dev
```

Запустить весь стек через Docker Compose:

```bash
cd deploy
docker compose up -d --build
```

Открыть приложение через gateway:

```text
http://localhost:8023
```

Gateway нужен специально: backend, web и TURN живут внутри Docker-сети, наружу по HTTP смотрит
только nginx на порту `8023`.

## Основные команды из корня

| Команда                | Что делает                                          |
| ---------------------- | --------------------------------------------------- |
| `npm run dev`          | Запускает Vite dev server для `app/webapp`.         |
| `npm run build`        | Собирает app workspace: KVT packages и webapp.      |
| `npm run lint`         | Запускает ESLint для webapp и все Go-тесты backend. |
| `npm run test`         | Alias для `npm run lint`.                           |
| `npm run test:backend` | Запускает только Go-тесты backend.                  |
| `npm run format`       | Форматирует репозиторий через Prettier и `gofmt`.   |
| `npm run format:check` | Проверяет форматирование без изменений файлов.      |
| `npm run docs:dev`     | Запускает VitePress документацию локально.          |
| `npm run docs:build`   | Собирает документацию.                              |
| `npm run docs:preview` | Показывает собранную документацию.                  |

## Документация

Запустить документацию:

```bash
npm run docs:dev
```

Документация разделена на два основных раздела:

- `KVT` - документация framework packages: `@kvt/core`, `@kvt/react`, `@kvt/theme`.
- `Webapp` - onboarding для разработчиков продукта: архитектура, конвенции, backend, deploy,
  env-переменные, дизайн-система, i18n и adaptive layouts.

Локальные ссылки:

- `http://localhost:5173/kvt/guide/`
- `http://localhost:5173/webapp/`
- `http://localhost:5173/ru/kvt/guide/`
- `http://localhost:5173/ru/webapp/`

## Backend документация

Когда стек запущен через Docker Compose:

```text
http://localhost:8023/api/swagger
http://localhost:8023/api/openapi.json
http://localhost:8023/healthz
```

На production:

```text
https://<your-domain>/api/swagger
https://<your-domain>/api/openapi.json
https://<your-domain>/healthz
```

Swagger описывает REST endpoints и WebSocket signaling message schemas.

## Архитектура webapp

```text
app/webapp/src/
  app/           bootstrap, router, DI composition
  core/          app technical layer и product design system
  capabilities/  reusable product subsystems
  features/      user-facing flows и screens
```

KVT даёт framework primitives:

- DI container и modules.
- ViewModel lifecycle.
- Flow, StateFlow, SharedFlow.
- React adapter hooks.
- Route-aware lazy feature loading.
- Theme provider и tokens.

Продуктовое приложение владеет:

- feature boundaries;
- room/prejoin/home flows;
- design system;
- i18n resources;
- RTC/media capability implementations.

## Правила разработки

- Используем только `app/webapp`; старый root `web` клиент удалён.
- Не создаём repositories или use cases внутри React components.
- Views отображают state и отправляют actions во ViewModel.
- ViewModels наружу отдают read-only `StateFlow` и one-off `SharedFlow` effects.
- User-visible feedback показываем через app-wide toast manager, а не через `console.info`.
- UI state и effects должны хранить typed translation keys, а не произвольные строки.
- Стили пишем через design-system tokens/components, без hard-coded visual values.
- Backend services держим внутри Docker-сети; публичный HTTP идёт через nginx gateway.

## Production deploy

Общий flow на сервере:

```bash
cd <project-dir>
git pull
cd deploy
docker compose build web backend
docker compose up -d --force-recreate web backend nginx
```

Если менялся только frontend, обычно достаточно:

```bash
cd deploy
docker compose build web
docker compose up -d --force-recreate web nginx
```

Перед production запуском настрой `deploy/.env`. Не коммить реальные production secrets.

Подробная инструкция есть в документации:

- `Webapp -> Local Development`
- `Webapp -> Production Deploy`
- `Webapp -> Environment Variables`
- `Webapp -> Backend`

## Troubleshooting

Если приложение отдаёт `502`:

```bash
cd deploy
docker compose ps
docker compose logs --tail=100 nginx backend web
curl -I http://127.0.0.1:8023/healthz
```

Если WebRTC работает в одной сети, но ломается в другой, проверь TURN и ICE-переменные в
`deploy/.env`, затем смотри backend logs и exported client logs.
