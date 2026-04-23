# Жизненный цикл ViewModel

KVT ViewModels вдохновлены Android
[ViewModel overview](https://developer.android.com/topic/libraries/architecture/viewmodel).

ViewModel хранит presentation state и переживает React re-renders. Она не пересоздается каждый раз,
когда вызывается component function.

## Ответственность

Используй ViewModel для:

- screen state;
- user intents;
- вызова use cases;
- public read-only `StateFlow`;
- one-off `SharedFlow` effects;
- cleanup long-lived work.

Не используй ViewModel для:

- DOM manipulation;
- visual component state вроде hover;
- JSX rendering;
- владения global application singletons.

## onInit()

`onInit()` — protected lifecycle method. Он запускается один раз, когда ViewModel впервые
resolve-ится через `useViewModel`.

```ts
class ChatViewModel extends ViewModel {
  protected onInit() {
    this.selectInitialChat()
  }
}
```

Используй `onInit()` для first load, subscriptions, timers и другого setup, который не должен
повторяться на каждый render.

## clear()

`clear()` вызывается `ViewModelStore`, когда owner disposed или key очищается.

Используй `onCleared()` или `addDisposable()` для cleanup:

```ts
class ChatViewModel extends ViewModel {
  protected onInit() {
    return socket.subscribe((event) => {
      // update state
    })
  }
}
```

Если `onInit()` возвращает cleanup function или `Disposable`, KVT автоматически его отслеживает.

## Владение route

`useViewModel()` очищает ViewModel, когда owning component unmount-ится. Для route page это значит,
что `onInit()` снова запустится, когда ты уйдешь со страницы и потом откроешь ее снова.

Используй `clearOnUnmount: false` только для app-level retained ViewModels:

```ts
const viewModel = useViewModel(AppViewModel, { clearOnUnmount: false })
```
