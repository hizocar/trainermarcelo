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
