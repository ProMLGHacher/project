# Disposable

`Disposable` is the cleanup contract used across KVT.

```ts
export interface Disposable {
  dispose(): void
}
```

If something starts work that must later stop, it should return or own a `Disposable`.

## Why it exists

JavaScript apps create many long-lived resources:

- event listeners;
- timers;
- Flow subscriptions;
- WebSocket subscriptions;
- child containers;
- feature scopes.

Without a shared cleanup contract, every API invents its own naming: `unsubscribe`, `stop`,
`removeListener`, `abort`, `close`. `Disposable` gives KVT one lifecycle language.

## Example

```ts
const subscription = flow.subscribe((value) => {
  console.log(value)
})

subscription.dispose()
```

## Subscription

`Subscription` wraps a cleanup callback and guarantees it runs only once.

```ts
return new Subscription(() => {
  window.removeEventListener('resize', listener)
})
```

## CompositeDisposable

`CompositeDisposable` owns many disposables and releases them together.

```ts
const disposables = new CompositeDisposable()

disposables.add(flow.subscribe(render))
disposables.add(timer)

disposables.dispose()
```

If you add a disposable after the composite was already disposed, KVT disposes the new value
immediately. This prevents accidentally leaking late resources.
