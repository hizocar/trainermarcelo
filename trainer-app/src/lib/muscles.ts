import type { Slug } from 'react-native-body-highlighter';

// Los grupos musculares del producto, en un solo lugar. Estaban duplicados
// literalmente en PlanEditorScreen y ProgramEditorScreen, y el mapa muscular
// tenía su propia traducción con nombres que no coincidían ("Gemelos" por
// "Gastrocnemios", "Aductores" por "Aductor"): cinco grupos se dibujaban en
// blanco sin que nada avisara. El test de este módulo impide que vuelva a pasar.
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
