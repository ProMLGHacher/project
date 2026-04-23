# Webapp Onboarding

This track is for engineers joining the product application.

It is not the KVT framework reference. It explains how this specific `app/webapp` codebase is
organized and what conventions we follow when building features.

## First day path

1. Read [Architecture](./architecture.md) to understand feature and capability boundaries.
2. Read [Conventions](./conventions.md) before changing presentation, domain, or data code.
3. Read [Local Development](./local-development.md) before running the stack.
4. Read [Production Deploy](./production-deploy.md) and [Environment Variables](./environment.md)
   before configuring a server.
5. Read [Design System](./design-system.md) before creating UI.
6. Read [Internationalization](./i18n.md) before adding user-facing copy.
7. Read [Adaptive Layouts](./adaptive-layouts.md) before touching responsive screens.

## Project map

```text
app/webapp/src/
  app/           app bootstrap, router, DI composition
  core/          app technical layer and product design system
  capabilities/  reusable product subsystems
  features/      user-facing flows and screens
```

## Daily commands

Run from repository root:

```bash
npm run lint
npm run build
```

Run only the app during UI work:

```bash
npm --prefix app run dev -w webapp
```

## What belongs here

Use these docs for project-specific decisions:

- feature folder conventions;
- local development setup;
- production deploy flow;
- environment variables;
- product design-system rules;
- translation ownership;
- room/prejoin/home flow ownership;
- responsive pane rules;
- onboarding checklists.

Use the [KVT framework docs](../kvt/guide/index.md) for framework primitives such as DI,
ViewModels, Flow, routing, and theme packages.

Use [Backend docs](../backend/index.md) for API/signaling/SFU architecture and backend runtime model.
