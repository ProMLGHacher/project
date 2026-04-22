# Архитектура приложения

KVT следует форме clean architecture, близкой к Android
[Guide to app architecture](https://developer.android.com/topic/architecture).

Главная идея — направление зависимостей:

```text
UI -> ViewModel -> UseCase -> Repository interface -> Repository implementation
```

Внешние слои могут зависеть от внутренних. Внутренние слои не должны знать про React, DOM, routing
или browser APIs, если это не их прямая ответственность.

## Слои

### UI layer

UI layer отображает state и передает user intents во ViewModel.

Используй этот слой для:

- React components;
- route components;
- layout и visual state;
- вызова ViewModel methods из user interactions.

Не делай здесь прямой data fetching, если это не действительно локальное UI-only состояние.

### Presentation layer

Presentation layer обычно представлен ViewModel. Он владеет UI state и преобразует domain results в
данные, удобные экрану.

Используй этот слой для:

- private `MutableStateFlow`;
- public read-only `StateFlow`;
- one-off `SharedFlow` effects;
- вызова use cases.

### Domain layer

Domain layer определяет business actions и contracts.

Используй этот слой для:

- use cases;
- repository interfaces;
- mappers;
- domain models;
- `Result<T, E>` return values.

### Data layer

Data layer реализует repository contracts и общается с внешним миром.

Используй этот слой для:

- HTTP clients;
- local storage;
- IndexedDB;
- in-memory stores;
- SDK adapters.

## Рекомендуемая структура feature

```text
features/chat/
  data.ts
  domain.ts
  presentation.ts
  di.ts
  ui/ChatPage.tsx
```

Это похоже на Android-style feature organization, но без необходимости заводить отдельный файл под
каждый маленький класс.
