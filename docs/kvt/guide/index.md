# Overview

KVT provides a small set of primitives that help a TypeScript app stay organized as it grows.

It is built around the same high-level guidance used in Android architecture docs:
separate UI from business logic, keep data ownership explicit, and make lifecycle rules clear.

## What KVT gives you

- `@kvt/core`: DI, ViewModel lifecycle, Flow primitives, use case contracts, result helpers.
- `@kvt/react`: React provider, hooks, ViewModel binding, route-aware lazy feature modules.
- `@kvt/theme`: theme tokens and a React provider for light/dark/system mode.

Project-specific i18n and design-system conventions live in the
[webapp onboarding docs](/webapp/).

## Recommended screen shape

```tsx
export function ChatPage() {
  const viewModel = useViewModel(ChatViewModel)
  const uiState = useStateFlow(viewModel.uiState)

  return <ChatLayout chats={uiState.chats} onSelectChat={(id) => viewModel.selectChat(id)} />
}
```

The component does not create repositories or use cases. It asks for a ViewModel and renders state.

## What to avoid

- Do not construct the full dependency graph inside React components.
- Do not put business rules in JSX event handlers.
- Do not expose mutable state from ViewModels.
- Do not ignore cleanup for subscriptions, timers, sockets, or event listeners.
