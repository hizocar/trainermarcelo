import { Platform } from 'react-native';

export const colors = {
  background: '#0A0A0A',
  surface: '#161616',
  card: '#1A1A1A',
  cardElevated: '#202020',
  accent: '#C8FF00',
  accentDark: '#9ACC00',
  accentSoft: 'rgba(200, 255, 0, 0.10)',
  textPrimary: '#FFFFFF',
  textSecondary: '#B8B8B8',
  textMuted: '#7A7A7A',
  border: '#262626',
  borderLight: '#333333',
  danger: '#FF4D4D',
  success: '#3DDC84',
  overlay: 'rgba(0, 0, 0, 0.55)',
} as const;

// Anton: display condensada estilo cartel deportivo (una sola weight, usar en mayúsculas)
export const fonts = {
  display: 'Anton_400Regular',
};

export const typography = {
  // titulares grandes — Anton, siempre en mayúsculas
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
  h3: { fontSize: 17, fontWeight: '700' as const, color: colors.textPrimary },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.textPrimary, lineHeight: 21 },
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
  sm: 10,
  md: 14,
  lg: 18,
  full: 999,
};

// sombra sutil para tarjetas (web usa boxShadow; nativo shadow*/elevation)
export const cardShadow = Platform.select({
  web: { boxShadow: '0 2px 16px rgba(0, 0, 0, 0.35)' } as object,
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
});
