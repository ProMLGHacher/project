# Темы

`@kvt/theme` владеет theme tokens и React theme provider.

Package специально отделен от `@kvt/core`, потому что core не должен знать про DOM, CSS variables
или React rendering.

## Provider

```tsx
<KvtThemeProvider>
  <App />
</KvtThemeProvider>
```

## Tokens

Theme tokens доступны как CSS variables. Application CSS и Tailwind classes могут использовать эти
variables вместо hard-coded colors.

Используй tokens для:

- surfaces;
- text colors;
- primary actions;
- borders;
- focus rings.

Избегай one-off hard-coded colors в feature components, если дизайн специально этого не требует.
