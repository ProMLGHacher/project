# Адаптивные layouts

KVT использует ту же ментальную модель, что Android adaptive layouts: экран описывает смысловые
panes, а дизайн-система решает, сколько panes можно показать в текущем окне.

Подход вдохновлен Android-документацией про
[canonical layouts](https://developer.android.com/develop/ui/compose/layouts/adaptive/canonical-layouts)
и
[supporting pane layouts](https://developer.android.com/develop/ui/compose/layouts/adaptive/build-a-supporting-pane-layout).

## Граница clean architecture

Adaptive layout живет в UI design-system layer, а не в domain или application services.

- ViewModel отдает immutable UI state и intents.
- Screen раскладывает state на смысловые panes: list, detail, main, supporting.
- Design-system scaffold решает, будет это `single`, `stack`, `dual` или `triple`.
- Domain code никогда не зависит от ширины экрана, browser APIs или layout-решений.

## Window size classes

В web-версии CSS pixels используются как аналог Android dp:

| Width class  | Диапазон       | Типичные устройства              |
| ------------ | -------------- | -------------------------------- |
| `compact`    | `< 600px`      | телефоны                         |
| `medium`     | `600..839px`   | крупные телефоны, малые планшеты |
| `expanded`   | `840..1199px`  | планшеты, малые desktop windows  |
| `large`      | `1200..1599px` | desktop                          |
| `extraLarge` | `>= 1600px`    | широкий desktop, dashboard       |

Высота тоже классифицируется как `compact`, `medium` или `expanded`. Компактная высота принудительно
переводит layout в single-pane, потому что side-by-side panes становятся слишком тесными.

## Supporting pane scaffold

Используй `SupportingPaneScaffold`, когда одна панель главная, а вторая дает контекст или summary.

```tsx
import { SupportingPaneScaffold } from '../core/design-system'

export function DashboardScreen() {
  return (
    <SupportingPaneScaffold
      compactBehavior="stack"
      mainPane={<MainDashboard />}
      supportingPane={<DashboardSummary />}
    />
  )
}
```

Поведение:

- `compact`: одна панель по умолчанию или вертикальный `stack`, если `compactBehavior="stack"`.
- `medium+`: main и supporting panes показываются рядом.
- compact height: одна панель, чтобы не ломать читаемость.

## List detail scaffold

Используй `ListDetailPaneScaffold`, когда пользователь выбирает элемент из списка и смотрит детали.

```tsx
import { ListDetailPaneScaffold } from '../core/design-system'

export function InboxScreen() {
  return (
    <ListDetailPaneScaffold
      listPane={<ConversationList />}
      detailPane={<ConversationDetails />}
      extraPane={<ContactCard />}
    />
  )
}
```

Поведение:

- `compact`: list/detail могут работать как single-pane navigation.
- `medium` и `expanded`: list и detail можно показывать вместе.
- `large` и `extraLarge`: можно показать optional third pane.

## Низкоуровневые utilities

Дизайн-система также экспортирует чистые helpers:

```ts
import { createPaneScaffoldDirective, createWindowSizeClass } from '../core/design-system'

const windowClass = createWindowSizeClass(1024, 768)
const directive = createPaneScaffoldDirective(windowClass, { paneCount: 2 })
```

Эти функции не зависят от React и browser runtime. React-часть ограничена `useWindowSizeClass`,
`usePaneNavigator` и scaffold-компонентами.
