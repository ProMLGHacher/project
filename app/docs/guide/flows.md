# Flows and State

KVT uses lightweight Flow primitives inspired by Android's
[StateFlow and SharedFlow](https://developer.android.com/kotlin/flow/stateflow-and-sharedflow).

## Flow

`Flow<T>` is a read-only stream of values.

```ts
const disposable = flow.subscribe((value) => {
  console.log(value)
})
```

Every subscription returns a `Disposable`.

## StateFlow

`StateFlow<T>` is a Flow with a current value. It is best for UI state.

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

`MutableStateFlow` should stay private. Expose `StateFlow` to the UI.

## SharedFlow

`SharedFlow<T>` is for one-off events that should not be treated as durable state.

Good examples:

- toast messages;
- navigation commands;
- analytics events;
- "copied to clipboard" effects.

```ts
private readonly effectEvents = new MutableSharedFlow<string>()
readonly effects = this.effectEvents.asSharedFlow()
```

## Operators

KVT includes small operators:

- `map`
- `combine`
- `distinctUntilChanged`

Keep operator chains readable. If transformation becomes business logic, move it into a use case or
mapper.
