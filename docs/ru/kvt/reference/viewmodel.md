# ViewModel

`ViewModel` — base class для presentation state holders.

Он вдохновлен Android ViewModel, но адаптирован под TypeScript и React.

## API

```ts
abstract class ViewModel {
  protected onInit(): void | Disposable | (() => void)
  initialize(): void // framework adapter API
  clear(): void
}
```

## onInit()

Override `onInit()` для one-time setup.

```ts
class ProfileViewModel extends ViewModel {
  protected onInit() {
    this.loadProfile()
  }
}
```

`useViewModel()` вызывает `initialize()`, а `initialize()` вызывает `onInit()` только один раз. UI
code не должен вызывать lifecycle methods напрямую.

## Cleanup

Верни cleanup прямо из `onInit()`:

```ts
protected onInit() {
  return this.repository.observeProfile((profile) => {
    this.state.set({ profile })
  })
}
```

Или зарегистрируй cleanup вручную:

```ts
this.addDisposable(subscription)
```

## ViewModelStore

`ViewModelStore` сохраняет ViewModel instances stable по key. Он очищает ViewModels, когда owning
store disposed или когда key явно очищен.

`useViewModel()` по умолчанию очищает ViewModel на component unmount. Передавай
`clearOnUnmount: false`, когда ViewModel должна жить весь app runtime.
