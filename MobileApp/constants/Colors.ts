/**
 * Premium light-first palette for MWMSYS mobile.
 *
 * The app is light-themed by default. The "dark" object mirrors the light
 * palette so existing screens that read Colors[scheme] never crash; we keep
 * it softer than true dark to avoid the "black/blue/white" look the old
 * theme had.
 */

const brand = {
  indigo: '#4f46e5',
  indigoSoft: '#818cf8',
  violet: '#7c3aed',
  violetSoft: '#a855f7',
  cyan: '#06b6d4',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  sky: '#0ea5e9',
};

export const Gradients = {
  primary: ['#6366f1', '#8b5cf6', '#ec4899'] as const,
  hero: ['#6366f1', '#a855f7'] as const,
  sunrise: ['#f59e0b', '#ef4444'] as const,
  ocean: ['#0ea5e9', '#22d3ee'] as const,
  mint: ['#10b981', '#22d3ee'] as const,
  peach: ['#fb7185', '#fbbf24'] as const,
  slate: ['#ffffff', '#f1f5ff'] as const,
  card: ['#ffffff', '#f8faff'] as const,
  auth: ['#eef2ff', '#f5f3ff', '#fdf2f8'] as const,
};

const light = {
  text: '#0f172a',
  background: '#f4f6fb',
  card: '#ffffff',
  cardAlt: '#f8faff',
  border: 'rgba(15, 23, 42, 0.08)',
  borderStrong: 'rgba(15, 23, 42, 0.14)',
  mutedText: 'rgba(15, 23, 42, 0.6)',
  faintText: 'rgba(15, 23, 42, 0.45)',
  tint: brand.indigo,
  tabIconDefault: 'rgba(15, 23, 42, 0.4)',
  tabIconSelected: brand.indigo,
  success: brand.emerald,
  warning: brand.amber,
  danger: '#ef4444',
  info: brand.sky,
  primary: brand.indigo,
  primaryForeground: '#ffffff',
  accent: brand.violet,
  accentForeground: '#ffffff',
  muted: '#eef2ff',
  secondary: '#f1f5f9',
  shadow: 'rgba(79, 70, 229, 0.12)',
};

export default {
  light,
  dark: light, // force light theme app-wide for a consistent premium look
};

