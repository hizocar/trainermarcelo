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

/**
 * Una sesión = una fila de `exercises` de origen (una vez programada en un
 * día de la semana concreto). Si el mismo ejercicio está programado dos
 * veces en la semana (ej. Press banca lunes y jueves), cada una es su
 * propia sesión, con su propia fecha, sets y volumen — no se mezclan.
 */
export interface HistorySession {
  key: string;
  date: string | null;
  sets: HistorySet[];
  volume: number;
}

export interface HistoryWeek {
  week: number;
  date: string | null;
  sessions: HistorySession[];
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

/**
 * Agrupa los logs por semana (más reciente primero) y, dentro de cada
 * semana, por sesión (más antigua primero). `sessionKeyBySeries` identifica
 * a qué fila de `exercises` de origen pertenece cada serie — normalmente el
 * id de esa fila — para no mezclar dos sesiones del mismo ejercicio dentro
 * de la misma semana (ej. Press banca lunes y jueves).
 */
export function groupHistoryByWeek(
  logs: LogRow[],
  seriesNumber: Record<string, number>,
  sessionKeyBySeries: Record<string, string>,
): HistoryWeek[] {
  const byWeek = new Map<number, Map<string, HistorySession>>();

  logs.forEach((l) => {
    const num = seriesNumber[l.series_id];
    if (num == null) return; // log de una serie que ya no existe en el plan

    const sessionKey = sessionKeyBySeries[l.series_id] ?? 'default';
    const weekSessions = byWeek.get(l.week_number) ?? new Map<string, HistorySession>();
    const session = weekSessions.get(sessionKey) ?? { key: sessionKey, date: null, sets: [], volume: 0 };
    session.sets.push({ series_number: num, weight: l.weight, reps: l.reps, rir: l.rir });
    session.volume += l.weight * l.reps;
    if (l.logged_at && (!session.date || l.logged_at < session.date)) session.date = l.logged_at;
    weekSessions.set(sessionKey, session);
    byWeek.set(l.week_number, weekSessions);
  });

  const weeks: HistoryWeek[] = Array.from(byWeek.entries()).map(([week, weekSessions]) => {
    const sessions = Array.from(weekSessions.values());
    sessions.forEach((s) => s.sets.sort((a, b) => a.series_number - b.series_number));
    sessions.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
    const volume = sessions.reduce((sum, s) => sum + s.volume, 0);
    const date = sessions.reduce<string | null>(
      (earliest, s) => (s.date && (!earliest || s.date < earliest) ? s.date : earliest), null);
    return { week, date, sessions, volume };
  });

  return weeks.sort((a, b) => b.week - a.week);
}

/** La mejor serie de todo el historial, por fuerza estimada (no por peso bruto). */
export function personalRecord(weeks: HistoryWeek[]): PR | null {
  const todas: PR[] = weeks.flatMap((w) =>
    w.sessions.flatMap((s) => s.sets.map((set) => ({ weight: set.weight, reps: set.reps, week: w.week }))));
  if (todas.length === 0) return null;
  return todas.reduce((best, cur) =>
    score(cur.weight, cur.reps) > score(best.weight, best.reps) ? cur : best);
}
