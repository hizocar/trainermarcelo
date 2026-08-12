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
