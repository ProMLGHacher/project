# Theming

`@kvt/theme` owns theme tokens and the React theme provider.

The package is intentionally separate from `@kvt/core`, because core should not know about DOM,
CSS variables, or React rendering.

## Provider

```tsx
<KvtThemeProvider>
  <App />
</KvtThemeProvider>
```

## Tokens

Theme tokens are exposed as CSS variables. Application CSS and Tailwind classes can use those
variables instead of hard-coded colors.

Use tokens for:

- surfaces;
- text colors;
- primary actions;
- borders;
- focus rings.

Avoid one-off hard-coded colors in feature components unless the design intentionally needs them.
