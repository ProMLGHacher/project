# Конвенции webapp

Эти правила помогают приложению оставаться предсказуемым.

## Presentation structure

Для product features используем:

```text
presentation/
  model/
  view/
  view_model/
```

Правила:

- `model` владеет UI state, actions, effects и typed message keys.
- `view_model` владеет presentation logic и вызывает use cases.
- `view` отображает state и отправляет user actions.
- Views не должны вызывать repositories, browser APIs или storage напрямую.

## ViewModel state

Наружу отдаём immutable state:

```ts
private readonly state = new MutableStateFlow<RoomUiState>(initialRoomState)
readonly uiState = this.state.asStateFlow()
```

Только ViewModel мутирует `MutableStateFlow`.

## Effects

Effects нужны для one-off actions:

- navigation;
- toast messages;
- file downloads;
- focus или modal events, если это не durable screen state.

Не клади one-off events в durable `uiState`.

## Toasts

Используй app-wide toast manager:

```ts
const toasts = useToast()

toasts.success(t('room.toasts.linkCopied'))
toasts.error(t('prejoin.errors.join'))
```

Не создавай локальные toast arrays внутри features. Не используй `console.info` для feedback,
который должен увидеть пользователь.

Console logs допустимы только для engineering diagnostics и должны проходить через client logging
capability, если они нужны support/debug flow.

## Translation keys

UI state и effects должны хранить typed translation keys, а не произвольные строки.

Используй helpers:

```ts
import type { PrefixedTranslationKey } from '@core/i18n/translation-key'

export type RoomToastMessageKey = PrefixedTranslationKey<'voice', 'room.toasts'>
```

Так TypeScript падает, если ViewModel emit-ит ключ, которого нет в переводах.

English resources используют `satisfies ResourceShape<typeof ruNamespace>`, поэтому если добавить
ключ в Russian и забыть English, build тоже упадёт.

## Imports

Используй aliases:

```ts
import { Button } from '@core/design-system'
import { RoomViewModel } from '@features/room/presentation/view_model/RoomViewModel'
```

Избегай глубоких relative imports между feature boundaries.

## Styling

Используй design-system tokens и Tailwind utilities, которые опираются на tokens.

Избегай:

- `rounded-[2rem]`;
- arbitrary colors, если есть token;
- duplicated media-query logic в каждой feature.

Предпочитай design-system components и adaptive pane primitives.

## Проверки

Перед commit:

```bash
npm run lint
npm run build
```

Backend tests входят в `npm run lint`.
