// Mismo epoch que trainer-app/src/lib/weeks.ts — TIENE que coincidir exacto,
// si no el coach ve "semana 8" en la web mientras el cliente ve "semana 9" en la app.
const TRAINING_EPOCH = new Date('2026-06-15T00:00:00');

/** Semana calendario actual del programa, sin tope: el tracking sigue indefinidamente. */
export function getCurrentWeek(): number {
  const diff = Math.floor((Date.now() - TRAINING_EPOCH.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, diff + 1);
}

export const WEEK_DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Lunes en que empieza una semana del programa. */
export function weekStartDate(week: number): Date {
  return new Date(TRAINING_EPOCH.getTime() + (week - 1) * 7 * 86400000);
}

/** "lun 6 ene" */
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${WEEK_DAYS_SHORT[d.getDay()].toLowerCase()} ${d.getDate()} ${months[d.getMonth()]}`;
}

/** A qué semana del programa pertenece una fecha (mínimo 1). */
export function weekNumberForDate(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = Math.floor((d.getTime() - TRAINING_EPOCH.getTime()) / (7 * 86400000));
  return Math.max(1, diff + 1);
}

/**
 * A qué semana del programa pertenece una fecha, para el calendario del
 * coach. A diferencia de `weekNumberForDate`, NO achica las fechas
 * anteriores al epoch a la semana 1: devuelve null, porque antes del epoch
 * el programa simplemente no existía (no hay que fabricar semana 1 sobre
 * meses de historia previos al alta del alumno). No se usa fuera del
 * calendario para no romper a los llamadores que sí dependen del clamp.
 */
export function calendarWeekNumberForDate(date: Date): number | null {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = Math.floor((d.getTime() - TRAINING_EPOCH.getTime()) / (7 * 86400000));
  return diff < 0 ? null : diff + 1;
}

/**
 * Las 7 fechas (lunes→domingo) de una semana de programa, como Date locales
 * a medianoche. Mismo criterio que weekStartDate/monthGrid (el epoch cae un
 * lunes, así que las semanas de programa coinciden exacto con las filas del
 * calendario). Se usa para saber, dado un día planificado que no se cumplió
 * el día que tocaba, si igual se entrenó en OTRO día de esa misma semana.
 */
export function weekDates(week: number): Date[] {
  const start = weekStartDate(week);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/**
 * Clave "YYYY-MM-DD" de una fecha local (mismos componentes que usa el
 * calendario para sus celdas — no es un instante real, no hay zona horaria
 * que convertir).
 */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * De los ejercicios de un día planificado, en qué días de su semana de
 * programa (weekDayKeys, lunes→domingo, clave "YYYY-MM-DD") hay al menos un
 * registro — aparte del propio día planificado (plannedKey). Sirve para dos
 * cosas: decidir si un día planificado sin registro ese día debe mostrarse
 * como "movido" en vez de "perdido", y para saber en qué otros días dibujar
 * el bloque "hecho fuera de lo planificado".
 */
export function offScheduleDayKeys(
  exerciseIds: string[],
  weekDayKeys: string[],
  plannedKey: string,
  doneByDay: Map<string, Set<string>>,
): string[] {
  if (exerciseIds.length === 0) return [];
  return weekDayKeys.filter((key) => {
    if (key === plannedKey) return false;
    const done = doneByDay.get(key);
    if (!done) return false;
    return exerciseIds.some((id) => done.has(id));
  });
}

/**
 * Clave "YYYY-MM-DD" de un instante real (timestamp de Supabase) en la zona
 * horaria de Chile continental, sin importar en qué zona corre el servidor
 * (Vercel corre en UTC). Se usa para decidir a qué día del calendario
 * pertenece un registro (cardio, workout_logs), y para saber cuál es "hoy"
 * desde el punto de vista del alumno.
 */
export function santiagoDayKey(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(instant);
}

/**
 * Filas de 7 días (lunes→domingo) que cubren el mes completo. `month` es
 * 0-indexado igual que en Date. Incluye días del mes anterior/siguiente
 * para completar la primera y la última fila.
 */
export function monthGrid(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7)); // retrocede al lunes
  const last = new Date(year, month + 1, 0);

  const rows: Date[][] = [];
  const cursor = new Date(start);
  while (cursor <= last) {
    const row: Date[] = [];
    for (let i = 0; i < 7; i++) {
      row.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    rows.push(row);
  }
  return rows;
}
