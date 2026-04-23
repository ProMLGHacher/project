# Dependency Injection

KVT DI is constructor-based and explicit. It borrows the readability of Android/Hilt modules, but it
does not require reflection metadata.

Android reference: [Dependency injection in Android](https://developer.android.com/training/dependency-injection).

## Why DI exists

DI lets a screen ask for the thing it needs without manually building the whole dependency chain.

Instead of doing this in a component:

```ts
const repository = new InMemoryChatRepository()
const useCase = new SendChatMessageUseCase(repository)
const viewModel = new ChatViewModel(repository, useCase, ...)
```

the component only asks for the ViewModel:

```ts
const viewModel = useViewModel(ChatViewModel)
```

The container resolves the rest.

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

## Singleton lifecycle

`@Singleton()` is eager by default. The instance is created when the module is installed.

Use lazy only when you ask for it explicitly:

```ts
@Singleton({ lazy: true })
```

Lazy means the instance is created when it is first requested.

This keeps app startup fast and works well with route-level code splitting.

## Feature modules

Feature modules can be loaded by routes. The framework installs the DI module before rendering the
lazy component, so the screen can immediately resolve its ViewModel.
