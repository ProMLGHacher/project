# Архитектура webapp

Приложение следует feature-oriented clean architecture.

Коротко:

- `features` отвечают на вопрос, что делает пользователь.
- `capabilities` отвечают на вопрос, что умеет продукт.
- `core` владеет техническими app primitives, но не бизнес-концептами.
- `data/infra` владеет browser, HTTP, storage, RTC и другими низкоуровневыми adapters.

## Направление зависимостей

```text
view -> view-model -> use case -> repository interface -> repository implementation
```

Не разворачивай это направление в обратную сторону.

## Слои

### `src/app`

Владеет composition:

- bootstrap;
- providers;
- router;
- root DI module;
- feature module loading.

Business rules здесь не живут.

### `src/core`

Владеет app-wide technical tools:

- design system;
- i18n setup;
- generic state helper types;
- utilities без бизнес-семантики.

Не клади сюда `Room`, `Participant`, `RtcSession` или user preferences.

### `src/features`

Владеет user flows.

Текущие voice product examples:

- `home`: создать комнату и начать join flow.
- `prejoin`: имя, devices, local preview, final join.
- `room`: live room UI, participants, controls, diagnostics.

Feature может иметь:

```text
presentation/
  model/
  view/
  view_model/
domain/
  model/
  usecases/
  repository/
data/
  repository/
```

### `src/capabilities`

Владеет reusable product subsystems:

- media;
- RTC;
- session;
- clipboard;
- client logs;
- user preferences.

Capabilities могут содержать бизнес-логику, но не screen-specific orchestration.

## Примеры ownership

`JoinRoomUseCase` принадлежит room domain, потому что join — это business operation комнаты.

Сохранение display name принадлежит user preferences, а не room repository.

Prejoin может orchestrate обе операции, потому что prejoin — это user flow, который их координирует.

## Anti-patterns

- Не вызывай `navigator.mediaDevices` прямо из React views.
- Не вызывай `localStorage` прямо из ViewModels.
- Не создавай repositories или use cases внутри components.
- Не клади room или RTC business entities в `core`.
- Не делай capabilities зависимыми от features.
- Не добавляй translation keys как обычный `string` state.
