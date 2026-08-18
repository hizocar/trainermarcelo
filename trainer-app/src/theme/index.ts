import { Platform } from 'react-native';

// Monocromo puro: 5 grises, sin matiz de color. La jerarquía se construye por
// brillo, no por tono — "success" es más claro (vitalidad/progreso), "danger"
// más oscuro (se apaga), en vez de verde/rojo.
export const colors = {
  background: '#00030D',
  backgroundElevated: '#080B14',
  surface: '#10131C',
  card: '#12151E',
  cardElevated: '#1B1E27',
  accent: '#D8D9D7',
  accentDark: '#BFBFBF',
  accentSoft: 'rgba(216, 217, 215, 0.08)',
  accentGlow: 'rgba(216, 217, 215, 0.16)',
  textPrimary: '#D8D9D7',
  textSecondary: '#949DA6',
  textMuted: '#626B73',
  border: '#232732',
  borderLight: '#333844',
  danger: '#626B73',
  // Única excepción al monocromo: se reserva EXCLUSIVAMENTE para "esto
  // requiere que hagas algo". Por ser el único color de la app, no se puede
  // ignorar; si se empieza a usar para decorar, pierde todo su valor.
  warning: '#C9A227',
  success: '#D8D9D7',
  info: '#949DA6',
  overlay: 'rgba(0, 3, 13, 0.78)',
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

// resplandor para elementos destacados (CTA, valores clave). Es gris, no lima:
// el sistema es monocromo y la jerarquía se construye con brillo.
export const accentGlow = Platform.select({
  web: { boxShadow: '0 4px 22px rgba(216, 217, 215, 0.18)' } as object,
  default: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
});
