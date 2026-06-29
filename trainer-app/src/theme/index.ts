export const colors = {
  background: '#0A0A0A',
  surface: '#161616',
  card: '#1E1E1E',
  accent: '#C8FF00',
  accentDark: '#9ACC00',
  textPrimary: '#FFFFFF',
  textMuted: '#888888',
  border: '#2A2A2A',
  danger: '#FF4444',
  success: '#00CC66',
} as const;

export const typography = {
  h1: { fontSize: 32, fontWeight: '900' as const, letterSpacing: -1, color: colors.textPrimary },
  h2: { fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.5, color: colors.textPrimary },
  h3: { fontSize: 18, fontWeight: '700' as const, color: colors.textPrimary },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.textPrimary },
  caption: { fontSize: 12, fontWeight: '500' as const, color: colors.textMuted },
  label: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1, color: colors.textMuted },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
};
