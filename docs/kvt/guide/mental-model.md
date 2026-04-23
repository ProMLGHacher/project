# Mental Model

KVT is intentionally small. Most concepts exist to answer one practical question:

> Who owns this object, and when does it stop living?

## Runtime

`createKvt()` creates the application runtime:

- a DI `Container`;
- a `ViewModelStore`;
- a `dispose()` method for shutting the runtime down.

```ts
const runtime = createKvt()
```

Feature modules such as `chatModule` can be installed by the router when the route opens.

React receives the runtime through `KvtProvider`.

## Scope

A scope is an owner boundary. In KVT, the main scopes are:

- app runtime;
- child DI container;
- ViewModelStore key;
- route/feature module.

If a value should live only while a feature lives, bind it in that feature module. If a value should
live for the whole app, bind it in the app module.

## Cleanup

Cleanup is handled through `Disposable`.

Any object that registers something long-lived should return or own a `Disposable`:

- Flow subscriptions;
- browser event listeners;
- timers;
- sockets;
- child containers;
- ViewModel resources.
