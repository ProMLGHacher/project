# React Adapter

`@kvt/react` connects the framework runtime to React.

It owns React-specific lifecycle bindings. `@kvt/core` does not import React.

## Provider

```tsx
<KvtProvider runtime={runtime}>
  <KvtRouterProvider routes={appRoutes} />
</KvtProvider>
```

## useViewModel()

`useViewModel()` resolves a ViewModel from DI and keeps it stable across re-renders.

```ts
const viewModel = useViewModel(ChatViewModel)
```

The hook calls `viewModel.initialize()` once.

## useStateFlow()

`useStateFlow()` subscribes React to a `StateFlow` through `useSyncExternalStore`.

```ts
const uiState = useStateFlow(viewModel.uiState)
```

## useSharedFlow()

`useSharedFlow()` listens to one-off events.

```ts
useSharedFlow(viewModel.effects, (message) => {
  showToast(message)
})
```

## Router integration

KVT route helpers keep route declarations simple and install lazy feature modules before rendering
the lazy page.
