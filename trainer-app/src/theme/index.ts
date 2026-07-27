import { Platform } from 'react-native';

export const colors = {
  background: '#08090A',
  backgroundElevated: '#0E1012',
  surface: '#15181B',
  card: '#16191C',
  cardElevated: '#1D2126',
  accent: '#C8FF00',
  accentDark: '#9ACC00',
  accentSoft: 'rgba(200, 255, 0, 0.10)',
  accentGlow: 'rgba(200, 255, 0, 0.22)',
  textPrimary: '#FFFFFF',
  textSecondary: '#B4BAC1',
  textMuted: '#6E757D',
  border: '#23272C',
  borderLight: '#31363C',
  danger: '#FF5252',
  warning: '#FF9F1C',
  success: '#3DDC84',
  info: '#4CC9F0',
  overlay: 'rgba(0, 0, 0, 0.72)',
} as const;

// Anton: display condensada estilo cartel deportivo (una sola weight, usar en mayúsculas)
// JetBrains Mono: solo para datos medidos (pesos, reps, fechas, %) — cifras tabulares,
// separa visualmente "lo que se mide" de "lo que se lee".
export const fonts = {
  display: 'Anton_400Regular',
  mono: 'JetBrainsMono_600SemiBold',
};

export const typography = {
  display: {
    fontFamily: fonts.display,
    fontSize: 34,
    letterSpacing: 0.5,
    color: colors.textPrimary,
    ...(Platform.OS === 'web' ? { fontWeight: '400' as const } : {}),
  },
  displaySm: {
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: 0.5,
    color: colors.textPrimary,
    ...(Platform.OS === 'web' ? { fontWeight: '400' as const } : {}),
  },
  h1: { fontSize: 32, fontWeight: '900' as const, letterSpacing: -1, color: colors.textPrimary },
  h2: { fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.5, color: colors.textPrimary },
  h3: { fontSize: 17, fontWeight: '700' as const, letterSpacing: -0.2, color: colors.textPrimary },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.textPrimary, lineHeight: 21 },
  caption: { fontSize: 12, fontWeight: '500' as const, color: colors.textMuted },
  label: { fontSize: 11, fontWeight: '800' as const, letterSpacing: 1.2, color: colors.textMuted },
  // datos medidos: pesos, reps, fechas, deltas — cifras tabulares monoespaciadas
  mono: { fontFamily: fonts.mono, fontSize: 15, color: colors.textPrimary },
  monoLg: { fontFamily: fonts.mono, fontSize: 22, color: colors.textPrimary },
  monoSm: { fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted, letterSpacing: 0.3 },
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
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  full: 999,
};

// sombra sutil para tarjetas (web usa boxShadow; nativo shadow*/elevation)
export const cardShadow = Platform.select({
  web: { boxShadow: '0 6px 24px rgba(0, 0, 0, 0.45)' } as object,
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 14,
    elevation: 6,
  },
});

// resplandor lima para elementos destacados (CTA, valores clave)
export const accentGlow = Platform.select({
  web: { boxShadow: '0 4px 22px rgba(200, 255, 0, 0.28)' } as object,
  default: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
});
