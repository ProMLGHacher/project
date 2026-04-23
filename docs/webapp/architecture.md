# Webapp Architecture

The app follows feature-oriented clean architecture.

The short version:

- `features` answer what the user is doing.
- `capabilities` answer what the product can do.
- `core` owns technical app primitives, not business concepts.
- `data/infra` owns browser, HTTP, storage, RTC, and other low-level adapters.

## Dependency direction

```text
view -> view-model -> use case -> repository interface -> repository implementation
```

Do not invert this direction.

## Layers

### `src/app`

Owns app composition:

- bootstrap;
- providers;
- router;
- root DI module;
- feature module loading.

Do not put business rules here.

### `src/core`

Owns app-wide technical tools:

- design system;
- i18n setup;
- generic state helper types;
- utilities with no business semantics.

Do not put `Room`, `Participant`, `RtcSession`, or user preferences here.

### `src/features`

Owns user flows.

Current voice product examples:

- `home`: create room and start join flow.
- `prejoin`: name, devices, local preview, final join.
- `room`: live room UI, participant state, controls, diagnostics.

A feature can have:

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

Owns reusable product subsystems:

- media;
- RTC;
- session;
- clipboard;
- client logs;
- user preferences.

Capabilities may contain business logic, but not screen-specific flow orchestration.

## Feature ownership examples

`JoinRoomUseCase` belongs to the room domain because joining is a room business operation.

Saving a display name belongs to user preferences, not to room repository.

Prejoin is allowed to orchestrate both operations because prejoin is the user flow that coordinates
them.

## Anti-patterns

- Do not call `navigator.mediaDevices` directly from React views.
- Do not call `localStorage` directly from ViewModels.
- Do not construct repositories or use cases inside components.
- Do not put room or RTC business entities in `core`.
- Do not make capabilities depend on features.
- Do not add new translation keys as plain `string` state.
