# Маршрут онбординга

Эта страница дает практичный маршрут входа в проект для новых инженеров.

## 30 минут: ориентация в системе

1. Прочитай обзор репозитория в корневом `README.md`.
2. Прочитай [Обзор проекта](./overview.md).
3. Прочитай [Взаимодействие сервисов](./service-interactions.md).
4. Просмотри `deploy/README.md`, чтобы понять runtime-топологию.

Результат: можешь объяснить границы продукта и потоки запросов/медиа.

## 60 минут: ориентация в кодовой базе

1. Прочитай frontend-архитектуру: [Архитектура webapp](../webapp/architecture.md).
2. Прочитай backend-архитектуру: [Обзор backend](../backend/index.md).
3. Открой ключевые пути и свяжи зоны ответственности:
   - `app/webapp/src/app`
   - `app/webapp/src/features`
   - `app/webapp/src/capabilities`
   - `backend/internal/application`
   - `backend/internal/adapters`

Результат: можешь указать, где лежит UI-логика, domain use cases и adapters.

## 120 минут: локальный запуск и верификация

1. Установи зависимости:
   - `npm install`
   - `npm --prefix app install`
2. Подними только webapp:
   - `npm run dev`
3. Подними полный стек (для E2E media-проверок):
   - `cd deploy`
   - `docker compose up -d --build`
4. Проверь документацию и health:
   - `npm run docs:dev`
   - `curl -I http://localhost:8023/healthz`

Результат: можешь запустить продукт и знаешь, где смотреть логи при первых сбоях.

## Чеклист нового инженера

- Понимает границы feature и capability.
- Понимает разделение REST + WS signaling и WebRTC media.
- Понимает, почему nginx является единственной HTTP-точкой входа.
- Знает, где хранится room/session state в v1 (in-memory runtime backend).
- Знает, куда смотреть в первую очередь при проблемах join/media.
