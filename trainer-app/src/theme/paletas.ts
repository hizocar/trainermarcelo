// Las cuatro apariencias de la app — espejo de los temas del panel web
// (globals.css), con las mismas decisiones de curaduría: en cada tema el
// color de "atención" (warning) sigue significando una sola cosa y no se
// confunde con el acento. Carbón es el monocromo deliberado de siempre y
// el predeterminado; los otros nacen de las paletas que eligió el equipo.

export type NombreTema = 'carbon' | 'marfil' | 'electrico' | 'neon';

export const NOMBRES_TEMA: Record<NombreTema, string> = {
  carbon: 'Carbón',
  marfil: 'Marfil',
  electrico: 'Eléctrico',
  neon: 'Neón',
};

export interface Paleta {
  background: string;
  backgroundElevated: string;
  surface: string;
  card: string;
  cardElevated: string;
  accent: string;
  accentDark: string;
  accentSoft: string;
  accentGlow: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderLight: string;
  danger: string;
  warning: string;
  success: string;
  info: string;
  overlay: string;
}

export const PALETAS: Record<NombreTema, Paleta> = {
  // Monocromo puro: 5 grises, jerarquía por brillo. El ámbar se reserva
  // EXCLUSIVAMENTE para "esto requiere que hagas algo".
  carbon: {
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
    warning: '#C9A227',
    success: '#D8D9D7',
    info: '#949DA6',
    overlay: 'rgba(0, 3, 13, 0.78)',
  },
  // Crema cálida + azul pizarra.
  marfil: {
    background: '#FAF8F2',
    backgroundElevated: '#FFFFFF',
    surface: '#F1ECDF',
    card: '#FFFEFA',
    cardElevated: '#FFFFFF',
    accent: '#5F6A8C',
    accentDark: '#4D5674',
    accentSoft: 'rgba(95, 106, 140, 0.10)',
    accentGlow: 'rgba(95, 106, 140, 0.20)',
    textPrimary: '#2B2A24',
    textSecondary: '#6F6A5B',
    textMuted: '#8C846D',
    border: '#E3DDCC',
    borderLight: '#D9D2BF',
    danger: '#8C846D',
    warning: '#A9861F',
    success: '#5F6A8C',
    info: '#6F6A5B',
    overlay: 'rgba(43, 42, 36, 0.55)',
  },
  // Gris claro + navy; la atención pasa al rosa de la paleta.
  electrico: {
    background: '#F2F2F2',
    backgroundElevated: '#FFFFFF',
    surface: '#E9EBEE',
    card: '#FFFFFF',
    cardElevated: '#FFFFFF',
    accent: '#023E73',
    accentDark: '#02305A',
    accentSoft: 'rgba(2, 62, 115, 0.08)',
    accentGlow: 'rgba(2, 62, 115, 0.18)',
    textPrimary: '#101D2B',
    textSecondary: '#46586B',
    textMuted: '#7A8798',
    border: '#DCE0E5',
    borderLight: '#CBD1D9',
    danger: '#7A8798',
    warning: '#D3325B',
    success: '#023E73',
    info: '#46586B',
    overlay: 'rgba(16, 29, 43, 0.55)',
  },
  // Negro + amarillo; la atención pasa a naranja para no chocar con el acento.
  neon: {
    background: '#060606',
    backgroundElevated: '#0D0D0D',
    surface: '#131313',
    card: '#151515',
    cardElevated: '#1E1E1E',
    accent: '#EBD350',
    accentDark: '#D4BC3D',
    accentSoft: 'rgba(235, 211, 80, 0.08)',
    accentGlow: 'rgba(235, 211, 80, 0.16)',
    textPrimary: '#FFFFFF',
    textSecondary: '#C1CCD9',
    textMuted: '#626B6F',
    border: '#242424',
    borderLight: '#333333',
    danger: '#626B6F',
    warning: '#E2762D',
    success: '#EBD350',
    info: '#C1CCD9',
    overlay: 'rgba(0, 0, 0, 0.78)',
  },
};

export const TEMAS: NombreTema[] = ['carbon', 'marfil', 'electrico', 'neon'];

export function esNombreTema(v: unknown): v is NombreTema {
  return v === 'carbon' || v === 'marfil' || v === 'electrico' || v === 'neon';
}
