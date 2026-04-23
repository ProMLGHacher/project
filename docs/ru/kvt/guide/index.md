# Обзор

KVT дает небольшой набор primitives, которые помогают TypeScript-приложению оставаться понятным по
мере роста.

Фреймворк опирается на те же идеи, что и Android architecture docs: отделять UI от бизнес-логики,
явно показывать владельцев данных и делать lifecycle-правила понятными.

## Что дает KVT

- `@kvt/core`: DI, lifecycle ViewModel, Flow primitives, use case contracts, result helpers.
- `@kvt/react`: React provider, hooks, ViewModel binding, route-aware lazy feature modules.
- `@kvt/theme`: theme tokens и React provider для light/dark/system mode.

Project-specific i18n и design-system conventions живут в
[webapp onboarding docs](/ru/webapp/).

## Рекомендуемая форма экрана

```tsx
export function ChatPage() {
  const viewModel = useViewModel(ChatViewModel)
  const uiState = useStateFlow(viewModel.uiState)

  return <ChatLayout chats={uiState.chats} onSelectChat={(id) => viewModel.selectChat(id)} />
}
```

Компонент не создает repositories или use cases. Он запрашивает ViewModel и отображает state.

## Чего избегать

- Не собирай весь dependency graph внутри React components.
- Не клади business rules в JSX event handlers.
- Не отдавай наружу mutable state из ViewModel.
- Не игнорируй cleanup для subscriptions, timers, sockets и event listeners.
