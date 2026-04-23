# Dependency Injection

KVT DI — constructor-based и explicit. Он берет читаемость Android/Hilt modules, но не требует
reflection metadata.

Android reference: [Dependency injection in Android](https://developer.android.com/training/dependency-injection).

## Зачем нужен DI

DI позволяет экрану запросить то, что ему нужно, без ручной сборки всей цепочки зависимостей.

Вместо этого в компоненте:

```ts
const repository = new InMemoryChatRepository()
const useCase = new SendChatMessageUseCase(repository)
const viewModel = new ChatViewModel(repository, useCase, ...)
```

компонент просит только ViewModel:

```ts
const viewModel = useViewModel(ChatViewModel)
```

Container resolve-ит все остальное.

## Module style

```ts
@Module()
export class ChatModule {
  @Provides(chatRepositoryToken)
  @Singleton({ lazy: true })
  static repository() {
    return new InMemoryChatRepository()
  }

  @Provides(SendChatMessageUseCase)
  static sendMessage(@Inject(chatRepositoryToken) repository: ChatRepository) {
    return new SendChatMessageUseCase(repository)
  }
}
```

## Жизненный цикл Singleton

`@Singleton()` по умолчанию eager. Instance создается при install модуля.

Lazy нужно включать явно:

```ts
@Singleton({ lazy: true })
```

Lazy значит, что instance создается при первом запросе.

Так app startup остается быстрым, и это хорошо работает с route-level code splitting.

## Feature modules

Feature modules могут загружаться routes. Framework устанавливает DI module до render lazy
component, поэтому screen сразу может resolve-ить ViewModel.
