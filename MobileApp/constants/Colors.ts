const tintColorLight = '#2563eb';
const tintColorDark = '#60a5fa';

export default {
  light: {
    text: '#0f172a',
    background: '#f8fafc',
    card: '#ffffff',
    border: 'rgba(15, 23, 42, 0.12)',
    mutedText: 'rgba(15, 23, 42, 0.65)',
    tint: tintColorLight,
    tabIconDefault: 'rgba(15, 23, 42, 0.35)',
    tabIconSelected: tintColorLight,
    success: '#16a34a',
    danger: '#dc2626',
  },
  dark: {
    text: '#e5e7eb',
    background: '#0b1220',
    card: '#0f172a',
    border: 'rgba(148, 163, 184, 0.22)',
    mutedText: 'rgba(226, 232, 240, 0.65)',
    tint: tintColorDark,
    tabIconDefault: 'rgba(226, 232, 240, 0.45)',
    tabIconSelected: tintColorDark,
    success: '#22c55e',
    danger: '#ef4444',
  },
};
