# Adaptive Layouts

KVT follows the same mental model as Android adaptive layouts: screens describe semantic panes, and
the design system decides how many panes can be visible for the current window.

The idea is inspired by Android documentation for
[canonical layouts](https://developer.android.com/develop/ui/compose/layouts/adaptive/canonical-layouts)
and
[supporting pane layouts](https://developer.android.com/develop/ui/compose/layouts/adaptive/build-a-supporting-pane-layout).

## Clean architecture boundary

Adaptive layout belongs to the UI design-system layer, not to domain or application services.

- ViewModels expose immutable UI state and intents.
- Screens map that state to semantic panes: list, detail, main, supporting.
- Design-system scaffolds decide whether panes render as `single`, `stack`, `dual` or `triple`.
- Domain code never depends on screen width, browser APIs or layout decisions.

## Window size classes

The web implementation uses CSS pixels as the equivalent of Android dp:

| Width class  | Range          | Typical devices                  |
| ------------ | -------------- | -------------------------------- |
| `compact`    | `< 600px`      | phones                           |
| `medium`     | `600..839px`   | large phones, small tablets      |
| `expanded`   | `840..1199px`  | tablets, small desktop windows   |
| `large`      | `1200..1599px` | desktop                          |
| `extraLarge` | `>= 1600px`    | wide desktop, dashboard displays |

Height is also classified as `compact`, `medium` or `expanded`. A compact height forces a
single-pane layout, because side-by-side panes usually become cramped.

## Supporting pane scaffold

Use `SupportingPaneScaffold` when one pane is primary and another pane provides contextual support.

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

Behavior:

- `compact`: one pane by default, or vertical `stack` when `compactBehavior="stack"`.
- `medium+`: main and supporting panes render side by side.
- compact height: one pane, prioritizing usability over density.

## List detail scaffold

Use `ListDetailPaneScaffold` when the user selects from a collection and edits or reads details.

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

Behavior:

- `compact`: list/detail navigation can be single-pane.
- `medium` and `expanded`: list and detail can be visible together.
- `large` and `extraLarge`: optional third pane can be visible.

## Low-level utilities

The design system also exports pure helpers:

```ts
import { createPaneScaffoldDirective, createWindowSizeClass } from '../core/design-system'

const windowClass = createWindowSizeClass(1024, 768)
const directive = createPaneScaffoldDirective(windowClass, { paneCount: 2 })
```

These functions are framework-independent and easy to test. React-specific pieces are limited to
`useWindowSizeClass`, `usePaneNavigator` and scaffold components.
