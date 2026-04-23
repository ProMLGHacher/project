# Application Architecture

KVT follows a clean architecture shape similar to the guidance in Android's
[Guide to app architecture](https://developer.android.com/topic/architecture).

The important idea is dependency direction:

```text
UI -> ViewModel -> UseCase -> Repository interface -> Repository implementation
```

Outer layers can depend on inner layers. Inner layers should not know about React, DOM, routing, or
browser APIs unless that is their explicit responsibility.

## Layers

### UI layer

The UI layer renders state and forwards user intents to the ViewModel.

Use this layer for:

- React components.
- Route components.
- Layout and visual state.
- Calling ViewModel methods from user interactions.

Avoid direct data fetching here unless the data is truly local UI-only state.

### Presentation layer

The presentation layer is usually a ViewModel. It owns UI state and transforms domain results into
screen-friendly data.

Use this layer for:

- `MutableStateFlow` private state.
- public read-only `StateFlow`.
- one-off `SharedFlow` effects.
- calling use cases.

### Domain layer

The domain layer defines business actions and contracts.

Use this layer for:

- use cases;
- repository interfaces;
- mappers;
- domain models;
- `Result<T, E>` return values.

### Data layer

The data layer implements repository contracts and talks to the outside world.

Use this layer for:

- HTTP clients;
- local storage;
- IndexedDB;
- in-memory stores;
- SDK adapters.

## Recommended feature structure

```text
features/chat/
  data.ts
  domain.ts
  presentation.ts
  di.ts
  ui/ChatPage.tsx
```

This mirrors Android-style feature organization without requiring one folder per tiny class.
