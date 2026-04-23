# Design System

The project design system lives in `webapp/src/core/design-system`.

It is built on top of `@kvt/theme`: components use Tailwind classes backed by the same CSS
variables for colors, radii, typography and focus rings. This keeps product UI consistent across
light and dark themes while the product still owns visual decisions.

## Why it is in app core

KVT framework owns cross-product primitives: theme contracts, typography tokens and runtime
integration. Product-specific UI belongs to the app because component density, copy, interaction
details and visual tone change from product to product.

This is similar to Android/Material: the platform provides theming and component guidance, while an
app defines its own design system on top of those primitives.

## Usage

```tsx
import { Button, Card, CardContent, CardHeader, CardTitle } from '../core/design-system'

export function Example() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create room</CardTitle>
      </CardHeader>
      <CardContent>
        <Button>Create</Button>
      </CardContent>
    </Card>
  )
}
```

## Customization

Components accept `className` and are written with Tailwind classes. That means product code can
extend spacing, layout and visual details without forking the framework.

For deeper customization, change the design-system component in `src/core/design-system`. For global
colors, typography and radii, change `@kvt/theme` tokens.

## Component scope

The first version provides the full component surface as framework primitives:

- layout and surface components: `Card`, `Sheet`, `Drawer`, `Sidebar`, `ScrollArea`;
- form components: `Input`, `Textarea`, `Checkbox`, `RadioGroup`, `Select`, `Switch`, `Slider`;
- feedback components: `Alert`, `Toast`, `Sonner`, `Progress`, `Skeleton`, `Spinner`;
- navigation components: `Breadcrumb`, `Pagination`, `NavigationMenu`, `Tabs`;
- overlay components: `Dialog`, `AlertDialog`, `Popover`, `HoverCard`, `Tooltip`;
- data/display components: `Table`, `DataTable`, `Badge`, `Avatar`, `Kbd`, `AspectRatio`;
- interaction primitives: `Accordion`, `Collapsible`, `DropdownMenu`, `ContextMenu`, `Command`,
  `Combobox`, `Toggle`, `ToggleGroup`.
- adaptive layout scaffolds: `SupportingPaneScaffold`, `ListDetailPaneScaffold`,
  `useWindowSizeClass`, `usePaneNavigator`.

Complex components such as `Calendar`, `Chart`, `DataTable` and `Carousel` start as typed product
primitives. They establish styling and public names first; richer behavior can be added without
changing app imports.

## Adaptive panes

For responsive UX, prefer pane scaffolds over ad-hoc media queries in every feature. A feature
screen should describe semantic panes, while the design system chooses a compact, stacked, dual or
triple-pane presentation.

See [Adaptive Layouts](/webapp/adaptive-layouts).

## What is intentionally not included

`Typography` is not a component package in KVT. Typography is part of theme tokens and CSS variables,
so apps can use semantic markup directly.
