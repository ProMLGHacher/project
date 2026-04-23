# Ментальная модель

KVT намеренно маленький. Большинство концепций отвечают на один практичный вопрос:

> Кто владеет этим объектом, и когда он прекращает жить?

## Runtime

`createKvt()` создает application runtime:

- DI `Container`;
- `ViewModelStore`;
- `dispose()` method для shutdown runtime.

```ts
const runtime = createKvt()
```

Feature modules вроде `chatModule` могут устанавливаться router-ом при открытии route.

React получает runtime через `KvtProvider`.

## Scope

Scope — граница владения. В KVT основные scopes:

- app runtime;
- child DI container;
- ViewModelStore key;
- route/feature module.

Если значение должно жить только пока живет feature, bind его в feature module. Если значение должно
жить все приложение, bind его в app module.

## Cleanup

Cleanup делается через `Disposable`.

Любой объект, который регистрирует long-lived работу, должен возвращать или владеть `Disposable`:

- Flow subscriptions;
- browser event listeners;
- timers;
- sockets;
- child containers;
- ViewModel resources.
