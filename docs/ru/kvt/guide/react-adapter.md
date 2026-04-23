# React adapter

`@kvt/react` соединяет framework runtime с React.

Он владеет React-specific lifecycle bindings. `@kvt/core` не импортирует React.

## Provider

```tsx
<KvtProvider runtime={runtime}>
  <KvtRouterProvider routes={appRoutes} />
</KvtProvider>
```

## useViewModel()

`useViewModel()` resolve-ит ViewModel из DI и сохраняет ее stable между re-renders.

```ts
const viewModel = useViewModel(ChatViewModel)
```

Hook вызывает `viewModel.initialize()` один раз.

## useStateFlow()

`useStateFlow()` подписывает React на `StateFlow` через `useSyncExternalStore`.

```ts
const uiState = useStateFlow(viewModel.uiState)
```

## useSharedFlow()

`useSharedFlow()` слушает one-off events.

```ts
useSharedFlow(viewModel.effects, (message) => {
  showToast(message)
})
```

## Router integration

KVT route helpers сохраняют route declarations простыми и устанавливают lazy feature modules до
render lazy page.
