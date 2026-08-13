// Historial de UN ejercicio a lo largo de las semanas.
//
// Ojo con la continuidad: desde "Gestión de semanas", duplicar una semana crea
// filas nuevas en `exercises` (mismo ejercicio, id distinto). Agrupar por id
// partiría el historial en pedazos, así que se agrupa por library_id (o por
// nombre normalizado si el ejercicio no vino de la biblioteca). Misma decisión
// que en trainer-app/src/screens/client/ProgressScreen.tsx.

export interface LogRow {
  series_id: string;
  week_number: number;
  weight: number;
  reps: number;
  rir: number | null;
  logged_at: string | null;
}

export interface HistorySet {
  series_number: number;
  weight: number;
  reps: number;
  rir: number | null;
}

export interface HistoryWeek {
  week: number;
  date: string | null;
  sets: HistorySet[];
  volume: number;
}

export interface PR {
  weight: number;
  reps: number;
  week: number;
}

export function continuityKey(ex: { library_id?: string | null; name: string }): string {
  return ex.library_id ?? ex.name.trim().toLowerCase();
}

/** Fuerza estimada (Epley): captura mejoras de peso Y de reps en un solo número. */
export function score(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

/**
 * 1RM estimado, redondeado a 1 decimal. reps=1 devuelve el peso tal cual
 * (la fórmula de Epley daría 103.3 para 100x1, que sería absurdo mostrarle
 * al coach). Espejo exacto de oneRepMax en trainer-app/src/lib/progress.ts.
 */
export function oneRepMax(weight: number, reps: number): number | null {
  if (!weight || !reps || reps < 1) return null;
  if (reps === 1) return weight;
  return Math.round(score(weight, reps) * 10) / 10;
}

/** Agrupa los logs por semana, de la más reciente a la más antigua. */
export function groupHistoryByWeek(
  logs: LogRow[],
  seriesNumber: Record<string, number>,
): HistoryWeek[] {
  const byWeek = new Map<number, HistoryWeek>();

  logs.forEach((l) => {
    const num = seriesNumber[l.series_id];
    if (num == null) return; // log de una serie que ya no existe en el plan

    const entry = byWeek.get(l.week_number) ?? { week: l.week_number, date: null, sets: [], volume: 0 };
    entry.sets.push({ series_number: num, weight: l.weight, reps: l.reps, rir: l.rir });
    entry.volume += l.weight * l.reps;
    if (l.logged_at && (!entry.date || l.logged_at < entry.date)) entry.date = l.logged_at;
    byWeek.set(l.week_number, entry);
  });

  const weeks = Array.from(byWeek.values());
  weeks.forEach((w) => w.sets.sort((a, b) => a.series_number - b.series_number));
  return weeks.sort((a, b) => b.week - a.week);
}

/** La mejor serie de todo el historial, por fuerza estimada (no por peso bruto). */
export function personalRecord(weeks: HistoryWeek[]): PR | null {
  const todas: PR[] = weeks.flatMap((w) =>
    w.sets.map((s) => ({ weight: s.weight, reps: s.reps, week: w.week })));
  if (todas.length === 0) return null;
  return todas.reduce((best, cur) =>
    score(cur.weight, cur.reps) > score(best.weight, best.reps) ? cur : best);
}
