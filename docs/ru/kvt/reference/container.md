# Container

`Container` — dependency injection container в KVT.

Он хранит bindings и resolve-ит objects по class или token.

## Bind value

```ts
container.bindValue(ApiBaseUrlToken, 'https://api.example.com')
```

## Bind factory

```ts
container.bindFactory(UserRepositoryToken, (container) => {
  return new HttpUserRepository(container.resolve(HttpClientToken))
})
```

Factory bindings по умолчанию transient.

## Bind singleton

```ts
container.bindSingleton(UserRepositoryToken, (container) => {
  return new HttpUserRepository(container.resolve(HttpClientToken))
})
```

Singletons eager по умолчанию, когда устанавливаются через modules.

Lazy singleton нужно включать явно:

```ts
container.bindSingleton(UserRepositoryToken, factory, { lazy: true })
```

Lazy singletons создаются при первом resolve.

## Child containers

Child containers позволяют features override-ить или расширять bindings без мутации parent scope.

```ts
const featureContainer = runtime.container.createChild()
```

Когда child disposed, он отсоединяется от parent.
