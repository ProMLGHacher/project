# Webapp onboarding

Этот трек для разработчиков, которые подключаются к продуктовой части приложения.

Это не reference KVT framework. Здесь описано, как устроен конкретный `app/webapp` codebase и какие
conventions мы соблюдаем при разработке features.

## Маршрут первого дня

1. Прочитай [Архитектуру](./architecture.md), чтобы понять feature и capability boundaries.
2. Прочитай [Конвенции](./conventions.md) перед изменениями presentation/domain/data кода.
3. Прочитай [Локальную разработку](./local-development.md) перед запуском стека.
4. Прочитай [Backend](./backend.md) перед изменением API, signaling или SFU кода.
5. Прочитай [Production deploy](./production-deploy.md) и
   [Environment variables](./environment.md) перед настройкой сервера.
6. Прочитай [Дизайн-систему](./design-system.md) перед созданием UI.
7. Прочитай [Интернационализацию](./i18n.md) перед добавлением user-facing copy.
8. Прочитай [Адаптивные layouts](./adaptive-layouts.md) перед изменением responsive screens.

## Карта проекта

```text
app/webapp/src/
  app/           bootstrap, router, DI composition
  core/          app technical layer и product design system
  capabilities/  переиспользуемые product subsystems
  features/      пользовательские flows и screens
```

## Ежедневные команды

Из корня репозитория:

```bash
npm run lint
npm run build
```

Только приложение во время UI-разработки:

```bash
npm --prefix app run dev -w webapp
```

## Что находится здесь

Этот раздел описывает project-specific решения:

- feature folder conventions;
- local development setup;
- backend API/SFU ownership;
- production deploy flow;
- environment variables;
- product design-system rules;
- translation ownership;
- room/prejoin/home flow ownership;
- responsive pane rules;
- onboarding checklists.

Для framework primitives вроде DI, ViewModels, Flow, routing и theme packages смотри
[KVT framework docs](../kvt/guide/index.md).
