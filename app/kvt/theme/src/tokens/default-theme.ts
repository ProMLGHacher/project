import type { KvtTheme } from './types'

/**
 * Material/Compose-like theme contract: color scheme, typography and shapes.
 *
 * Values are exposed as CSS variables so Tailwind utilities and custom CSS read
 * the same source of truth.
 */
export const defaultKvtTheme: KvtTheme = {
  light: {
    primary: 'oklch(47.157% 0.20799 295.173)',
    primaryHover: 'oklch(42% 0.186 295.173)',
    primaryActive: 'oklch(38% 0.165 295.173)',
    primaryForeground: 'oklch(98.5% 0.01 295.173)',
    background: 'oklch(98.6% 0.003 290)',
    foreground: 'oklch(22.8% 0.021 285)',
    surface: 'oklch(100% 0 0)',
    surfaceForeground: 'oklch(24.2% 0.02 285)',
    muted: 'oklch(96.4% 0.008 288)',
    mutedForeground: 'oklch(49.6% 0.02 285)',
    accent: 'oklch(94.4% 0.022 295.173)',
    accentForeground: 'oklch(32.5% 0.06 295.173)',
    border: 'oklch(89.7% 0.012 287)',
    input: 'oklch(92.8% 0.01 287)',
    ring: 'oklch(47.157% 0.20799 295.173)',
    success: 'oklch(67% 0.17 150)',
    warning: 'oklch(82% 0.17 85)',
    destructive: 'oklch(63% 0.24 28)',
    info: 'oklch(65% 0.15 250)',
    onFeedback: 'oklch(99% 0 0)'
  },
  dark: {
    primary: 'oklch(70.2% 0.164 295.173)',
    primaryHover: 'oklch(66.5% 0.151 295.173)',
    primaryActive: 'oklch(61.4% 0.132 295.173)',
    primaryForeground: 'oklch(16.8% 0.01 286)',
    background: 'oklch(17.5% 0.015 286)',
    foreground: 'oklch(95.2% 0.01 286)',
    surface: 'oklch(18.5% 0.012 258)',
    surfaceForeground: 'oklch(95.2% 0.01 286)',
    muted: 'oklch(27.7% 0.017 286)',
    mutedForeground: 'oklch(77.8% 0.014 286)',
    accent: 'oklch(29.5% 0.02 286)',
    accentForeground: 'oklch(93.5% 0.015 286)',
    border: 'oklch(34.7% 0.015 286)',
    input: 'oklch(31.8% 0.014 286)',
    ring: 'oklch(70.2% 0.164 295.173)',
    success: 'oklch(74% 0.18 152)',
    warning: 'oklch(88% 0.16 86)',
    destructive: 'oklch(71% 0.19 29)',
    info: 'oklch(75% 0.12 250)',
    onFeedback: 'oklch(99% 0 0)'
  },
  typography: {
    fontSans: '"Manrope", ui-sans-serif, system-ui, sans-serif',
    fontDisplay: '"Manrope", ui-sans-serif, system-ui, sans-serif',
    fontMono: '"SFMono-Regular", ui-monospace, monospace',
    sizes: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
      '5xl': '3rem'
    },
    lineHeights: {
      tight: '1.2',
      snug: '1.35',
      normal: '1.55'
    },
    tracking: {
      tight: '-0.02em',
      normal: '0',
      wide: '0.02em'
    }
  },
  shapes: {
    radius: {
      xs: '0.25rem',
      sm: '0.375rem',
      md: '0.5rem',
      lg: '0.75rem',
      xl: '0.875rem',
      '2xl': '1rem'
    }
  }
}
