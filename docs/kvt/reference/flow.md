# Flow

Flow is KVT's observable data model.

## Flow

```ts
interface Flow<T> {
  subscribe(listener: (value: T) => void): Disposable
}
```

Use `Flow` when a value can change over time.

## StateFlow

`StateFlow<T>` is a Flow with a current value.

```ts
interface StateFlow<T> extends Flow<T> {
  readonly value: T
}
```

Use it for UI state.

## MutableStateFlow

`MutableStateFlow<T>` is the writable implementation.

Keep it private:

```ts
private readonly state = new MutableStateFlow({ loading: false })
readonly uiState = this.state.asStateFlow()
```

## SharedFlow

`SharedFlow<T>` is for one-off events and does not replay old values to new subscribers.

Use it for effects, not durable screen state.
