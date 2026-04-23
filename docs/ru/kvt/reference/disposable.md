# Disposable

`Disposable` — cleanup contract, который используется во всем KVT.

```ts
export interface Disposable {
  dispose(): void
}
```

Если что-то запускает работу, которую позже нужно остановить, оно должно возвращать или владеть
`Disposable`.

## Зачем он нужен

JavaScript apps создают много long-lived resources:

- event listeners;
- timers;
- Flow subscriptions;
- WebSocket subscriptions;
- child containers;
- feature scopes.

Без общего cleanup contract каждый API придумывает свое имя: `unsubscribe`, `stop`,
`removeListener`, `abort`, `close`. `Disposable` дает KVT один lifecycle language.

## Пример

```ts
const subscription = flow.subscribe((value) => {
  console.log(value)
})

subscription.dispose()
```

## Subscription

`Subscription` оборачивает cleanup callback и гарантирует, что он выполнится только один раз.

```ts
return new Subscription(() => {
  window.removeEventListener('resize', listener)
})
```

## CompositeDisposable

`CompositeDisposable` владеет множеством disposables и освобождает их вместе.

```ts
const disposables = new CompositeDisposable()

disposables.add(flow.subscribe(render))
disposables.add(timer)

disposables.dispose()
```

Если добавить disposable после того, как composite уже disposed, KVT сразу dispose-ит новое значение.
Так late resources не протекают случайно.
