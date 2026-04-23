# Container

`Container` is KVT's dependency injection container.

It stores bindings and resolves objects by class or token.

## Bind a value

```ts
container.bindValue(ApiBaseUrlToken, 'https://api.example.com')
```

## Bind a factory

```ts
container.bindFactory(UserRepositoryToken, (container) => {
  return new HttpUserRepository(container.resolve(HttpClientToken))
})
```

Factory bindings are transient by default.

## Bind a singleton

```ts
container.bindSingleton(UserRepositoryToken, (container) => {
  return new HttpUserRepository(container.resolve(HttpClientToken))
})
```

Singletons are eager by default when installed through modules.

Use lazy singleton behavior explicitly:

```ts
container.bindSingleton(UserRepositoryToken, factory, { lazy: true })
```

Lazy singletons are created the first time they are resolved.

## Child containers

Child containers let features override or extend bindings without mutating the parent scope.

```ts
const featureContainer = runtime.container.createChild()
```

When the child is disposed, it detaches from the parent.
