# Дизайн-система

Project design system находится в `webapp/src/core/design-system`.

Она построена поверх `@kvt/theme`: компоненты используют Tailwind classes, которые опираются на CSS
variables темы для цветов, радиусов, типографики и focus rings. Так product UI остается
консистентным в светлой и темной теме, но визуальные решения остаются внутри продукта.

## Почему это в app core

KVT framework владеет cross-product primitives: theme contracts, typography tokens и runtime
integration. Product-specific UI должен жить в приложении, потому что density, copy, interaction
details и visual tone меняются от продукта к продукту.

Это похоже на Android/Material: platform дает theming и component guidance, а app строит свою
дизайн-систему поверх этих primitives.

## Использование

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

## Кастомизация

Компоненты принимают `className` и написаны через Tailwind classes. Значит product code может
расширять spacing, layout и visual details без fork фреймворка.

Для глубокой кастомизации меняй компонент в `src/core/design-system`. Для глобальных цветов,
типографики и радиусов меняй tokens в `@kvt/theme`.

## Scope компонентов

Первая версия дает полный component surface как framework primitives:

- layout и surface: `Card`, `Sheet`, `Drawer`, `Sidebar`, `ScrollArea`;
- forms: `Input`, `Textarea`, `Checkbox`, `RadioGroup`, `Select`, `Switch`, `Slider`;
- feedback: `Alert`, `Toast`, `Sonner`, `Progress`, `Skeleton`, `Spinner`;
- navigation: `Breadcrumb`, `Pagination`, `NavigationMenu`, `Tabs`;
- overlays: `Dialog`, `AlertDialog`, `Popover`, `HoverCard`, `Tooltip`;
- data/display: `Table`, `DataTable`, `Badge`, `Avatar`, `Kbd`, `AspectRatio`;
- interaction primitives: `Accordion`, `Collapsible`, `DropdownMenu`, `ContextMenu`, `Command`,
  `Combobox`, `Toggle`, `ToggleGroup`.
- adaptive layout scaffolds: `SupportingPaneScaffold`, `ListDetailPaneScaffold`,
  `useWindowSizeClass`, `usePaneNavigator`.

Сложные компоненты вроде `Calendar`, `Chart`, `DataTable` и `Carousel` сейчас являются typed product
primitives. Они фиксируют styling и публичные имена; более богатое поведение можно добавить позже
без изменения imports в приложениях.

## Adaptive panes

Для responsive UX лучше использовать pane scaffolds, а не писать ad-hoc media queries в каждой
фиче. Feature screen должен описывать смысловые panes, а дизайн-система выбирает compact, stack,
dual или triple-pane presentation.

Смотри [Адаптивные layouts](/ru/webapp/adaptive-layouts).

## Чего здесь нет

`Typography` не выделен в отдельный component package. Типографика живет в theme tokens и CSS
variables, поэтому приложения могут использовать обычную semantic markup.
