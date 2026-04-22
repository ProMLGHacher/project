# ViewModel Lifecycle

KVT ViewModels are inspired by Android's
[ViewModel overview](https://developer.android.com/topic/libraries/architecture/viewmodel).

A ViewModel stores presentation state and survives React re-renders. It is not recreated every time
the component function runs.

## Responsibilities

Use a ViewModel for:

- screen state;
- user intents;
- calling use cases;
- exposing read-only `StateFlow`;
- emitting one-off `SharedFlow` effects;
- cleaning up long-lived work.

Do not use a ViewModel for:

- DOM manipulation;
- visual component state such as hover;
- direct JSX rendering;
- owning global application singletons.

## onInit()

`onInit()` is a protected lifecycle method. It runs once when the ViewModel is first resolved through
`useViewModel`.

```ts
class ChatViewModel extends ViewModel {
  protected onInit() {
    this.selectInitialChat()
  }
}
```

Use `onInit()` for first load, subscriptions, timers, and other setup that should not repeat on every
render. UI code does not call this method.

## clear()

`clear()` is called by `ViewModelStore` when the owner is disposed or the key is cleared.

Use `onCleared()` or `addDisposable()` for cleanup:

```ts
class ChatViewModel extends ViewModel {
  protected onInit() {
    return socket.subscribe((event) => {
      // update state
    })
  }
}
```

If `onInit()` returns a cleanup function or `Disposable`, KVT automatically tracks it.

## Route ownership

`useViewModel()` clears its ViewModel when the owning component unmounts. For a route page, this
means `onInit()` runs again when you leave the route and later open it again.

Use `clearOnUnmount: false` only for app-level retained ViewModels:

```ts
const viewModel = useViewModel(AppViewModel, { clearOnUnmount: false })
```
