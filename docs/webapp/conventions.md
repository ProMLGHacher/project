# Webapp Conventions

These conventions keep the product app predictable as it grows.

## Presentation structure

For product features, use:

```text
presentation/
  model/
  view/
  view_model/
```

Rules:

- `model` owns UI state, actions, effects, and typed message keys.
- `view_model` owns presentation logic and calls use cases.
- `view` renders state and sends user actions.
- Views should not call repositories, browser APIs, or storage directly.

## ViewModel state

Expose immutable state:

```ts
private readonly state = new MutableStateFlow<RoomUiState>(initialRoomState)
readonly uiState = this.state.asStateFlow()
```

Only the ViewModel mutates `MutableStateFlow`.

## Effects

Use effects for one-off actions:

- navigation;
- toast messages;
- file downloads;
- focus or modal events when they are not durable screen state.

Do not put one-off events into durable `uiState`.

## Toasts

Use the app-wide toast manager:

```ts
const toasts = useToast()

toasts.success(t('room.toasts.linkCopied'))
toasts.error(t('prejoin.errors.join'))
```

Do not create local toast arrays in features. Do not use `console.info` for user-visible feedback.

Console logs are allowed only for engineering diagnostics and must go through the client logging
capability when they are useful for support.

## Translation keys

UI state and effects must store typed translation keys, not arbitrary strings.

Use the shared helpers:

```ts
import type { PrefixedTranslationKey } from '@core/i18n/translation-key'

export type RoomToastMessageKey = PrefixedTranslationKey<'voice', 'room.toasts'>
```

This makes TypeScript fail when a ViewModel emits a key that does not exist.

English resources use `satisfies ResourceShape<typeof ruNamespace>` so adding a key to Russian and
forgetting English also fails at build time.

## Imports

Use aliases:

```ts
import { Button } from '@core/design-system'
import { RoomViewModel } from '@features/room/presentation/view_model/RoomViewModel'
```

Avoid deep relative imports across feature boundaries.

## Styling

Use design-system tokens and Tailwind utilities that map to tokens.

Avoid hard-coded one-off values such as:

- `rounded-[2rem]`;
- arbitrary colors when a token exists;
- duplicated media-query logic inside each feature.

Prefer design-system components and adaptive pane primitives.

## Tests and checks

Before committing:

```bash
npm run lint
npm run build
```

Backend tests are included in `npm run lint`.
