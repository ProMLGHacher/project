# Flow

Flow — observable data model в KVT.

## Flow

```ts
interface Flow<T> {
  subscribe(listener: (value: T) => void): Disposable
}
```

Используй `Flow`, когда значение может изменяться со временем.

## StateFlow

`StateFlow<T>` — Flow с current value.

```ts
interface StateFlow<T> extends Flow<T> {
  readonly value: T
}
```

Используй его для UI state.

## MutableStateFlow

`MutableStateFlow<T>` — writable implementation.

Держи его private:

```ts
private readonly state = new MutableStateFlow({ loading: false })
readonly uiState = this.state.asStateFlow()
```

## SharedFlow

`SharedFlow<T>` нужен для one-off events и не replay-ит old values новым subscribers.

Используй его для effects, не для durable screen state.
