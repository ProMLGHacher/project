# ViewModel

`ViewModel` is the base class for presentation state holders.

It is inspired by Android ViewModel, but adapted for TypeScript and React.

## API

```ts
abstract class ViewModel {
  protected onInit(): void | Disposable | (() => void)
  initialize(): void // framework adapter API
  clear(): void
}
```

## onInit()

Override `onInit()` for one-time setup.

```ts
class ProfileViewModel extends ViewModel {
  protected onInit() {
    this.loadProfile()
  }
}
```

`useViewModel()` calls `initialize()`, and `initialize()` calls `onInit()` only once. UI code should
not call lifecycle methods directly.

## Cleanup

Return cleanup directly from `onInit()`:

```ts
protected onInit() {
  return this.repository.observeProfile((profile) => {
    this.state.set({ profile })
  })
}
```

Or register cleanup manually:

```ts
this.addDisposable(subscription)
```

## ViewModelStore

`ViewModelStore` keeps ViewModel instances stable by key. It clears ViewModels when the owning store
is disposed or when a key is explicitly cleared.

`useViewModel()` clears the ViewModel on component unmount by default. Pass `clearOnUnmount: false`
when a ViewModel must live for the whole app runtime.
