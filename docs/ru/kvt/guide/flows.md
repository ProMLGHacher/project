# Flows и состояние

KVT использует lightweight Flow primitives, вдохновленные Android
[StateFlow and SharedFlow](https://developer.android.com/kotlin/flow/stateflow-and-sharedflow).

## Flow

`Flow<T>` — read-only stream значений.

```ts
const disposable = flow.subscribe((value) => {
  console.log(value)
})
```

Каждая subscription возвращает `Disposable`.

## StateFlow

`StateFlow<T>` — Flow с current value. Лучше всего подходит для UI state.

```ts
type ChatUiState = {
  selectedChatId: string | null
  chats: readonly ChatListItem[]
}

class ChatViewModel extends ViewModel {
  private readonly state = new MutableStateFlow<ChatUiState>({ selectedChatId: null, chats: [] })
  readonly uiState = this.state.asStateFlow()
}
```

`MutableStateFlow` должен оставаться private. В UI отдавай `StateFlow`.

## SharedFlow

`SharedFlow<T>` нужен для one-off events, которые не являются durable state.

Хорошие примеры:

- toast messages;
- navigation commands;
- analytics events;
- "copied to clipboard" effects.

```ts
private readonly effectEvents = new MutableSharedFlow<string>()
readonly effects = this.effectEvents.asSharedFlow()
```

## Operators

KVT включает маленькие operators:

- `map`
- `combine`
- `distinctUntilChanged`

Держи chains читаемыми. Если transformation превращается в business logic, перенеси ее в use case
или mapper.
