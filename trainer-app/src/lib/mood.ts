// Ánimo/energía diaria.
//
// La base guarda `mood_logs.mood` como texto con una escala de 1 a 10 y esa
// escala NO cambia: hay registros históricos con 3, 7 y 9 que siguen siendo
// válidos. Lo que cambia es la pregunta: el alumno ya no elige un número sino
// una de cinco caras, y cada cara escribe uno de los valores pares 2/4/6/8/10.
// Para pintar un registro viejo se busca la cara más cercana.

export type MoodFaceLevel = 1 | 2 | 3 | 4 | 5;

export const MOOD_FACE_LEVELS: MoodFaceLevel[] = [1, 2, 3, 4, 5];

/** Escala real de la base: 1 = agotado, 10 = con mucha energía. */
export const MOOD_MIN = 1;
export const MOOD_MAX = 10;

const FACE_LABELS: Record<MoodFaceLevel, string> = {
  1: 'Muy cansado',
  2: 'Cansado',
  3: 'Normal',
  4: 'Con energía',
  5: 'Con mucha energía',
};

/** Texto en palabras de una cara (para lectores de pantalla). */
export function moodFaceLabel(level: MoodFaceLevel): string {
  return FACE_LABELS[level];
}

/** Cara (1-5) → valor que se guarda en la base (2/4/6/8/10). */
export function moodValueForFace(level: MoodFaceLevel): number {
  return level * 2;
}

/**
 * Valor guardado (1-10) → cara más cercana. Los valores impares antiguos caen
 * en la cara más cercana y los empates (3, 5, 7, 9) se resuelven hacia arriba,
 * que es lo que hace Math.round. Fuera de rango se recorta a los extremos;
 * un valor no numérico devuelve null (mejor no dibujar nada que mentir).
 */
export function faceForMoodValue(value: number): MoodFaceLevel | null {
  if (!Number.isFinite(value)) return null;
  const clamped = Math.min(MOOD_MAX, Math.max(MOOD_MIN, value));
  const face = Math.min(5, Math.max(1, Math.round(clamped / 2)));
  return face as MoodFaceLevel;
}

/** Igual que faceForMoodValue pero desde el texto que viene de la base. */
export function faceForMoodText(mood: string | null | undefined): MoodFaceLevel | null {
  if (mood == null) return null;
  return faceForMoodValue(parseInt(mood, 10));
}

export interface MoodRecord {
  mood: string;
  logged_date: string; // YYYY-MM-DD
}

export interface MoodPoint {
  label: string;
  value: number;
}

/** "2026-08-13" → "13/08" (etiqueta corta para el eje X). */
export function shortDayLabel(loggedDate: string): string {
  return `${loggedDate.slice(8, 10)}/${loggedDate.slice(5, 7)}`;
}

/**
 * Puntos del gráfico a partir de los registros que la pantalla ya tiene en
 * memoria (no hay consulta nueva). El estado llega del más reciente al más
 * antiguo, así que acá se ordena cronológicamente; los registros ilegibles se
 * descartan y los valores fuera de rango se recortan a 1-10 para que un dato
 * corrupto no aplaste la escala del gráfico.
 */
export function moodChartPoints(moods: MoodRecord[]): MoodPoint[] {
  return moods
    .filter(m => Number.isFinite(parseInt(m.mood, 10)))
    .slice()
    .sort((a, b) => a.logged_date.localeCompare(b.logged_date))
    .map(m => ({
      label: shortDayLabel(m.logged_date),
      value: Math.min(MOOD_MAX, Math.max(MOOD_MIN, parseInt(m.mood, 10))),
    }));
}
