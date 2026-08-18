import type { Slug } from 'react-native-body-highlighter';

// Los grupos musculares del producto, en un solo lugar. La lista estaba
// duplicada literalmente en PlanEditorScreen y ProgramEditorScreen; se extrajo
// acá junto con su traducción a las zonas del muñeco (`SLUG_POR_GRUPO`), con
// tests que fallan si ambas listas se desalinean. Verificado contra la base:
// los 841 ejercicios de la biblioteca usan 16 grupos distintos y los planes
// reales usan 12, todos dentro de estos 17 — no hay etiquetas huérfanas hoy.
export const MUSCLE_GROUPS = [
  'Pecho', 'Espalda alta', 'Espalda baja',
  'Hombro anterior', 'Hombro medial', 'Hombro posterior',
  'Bíceps', 'Tríceps', 'Antebrazos',
  'Cuádriceps', 'Isquiotibiales', 'Aductor',
  'Glúteo mayor', 'Glúteo medio', 'Glúteo menor',
  'Gastrocnemios', 'Core',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

/**
 * Cada grupo del producto → la zona que dibuja `react-native-body-highlighter`.
 *
 * Varias zonas del cuerpo son más gruesas que nuestros grupos y por eso hay
 * traducciones de muchos a uno:
 *   - las tres cabezas de hombro caen en `deltoids`;
 *   - los tres glúteos caen en `gluteal`.
 * El desglose fino se conserva en las listas de series; solo el muñeco los funde.
 */
export const SLUG_POR_GRUPO: Record<MuscleGroup, Slug> = {
  'Pecho': 'chest',
  'Espalda alta': 'upper-back',
  'Espalda baja': 'lower-back',
  'Hombro anterior': 'deltoids',
  'Hombro medial': 'deltoids',
  'Hombro posterior': 'deltoids',
  'Bíceps': 'biceps',
  'Tríceps': 'triceps',
  'Antebrazos': 'forearm',
  'Cuádriceps': 'quadriceps',
  'Isquiotibiales': 'hamstring',
  'Aductor': 'adductors',
  'Glúteo mayor': 'gluteal',
  'Glúteo medio': 'gluteal',
  'Glúteo menor': 'gluteal',
  'Gastrocnemios': 'calves',
  'Core': 'abs',
};
