export const WEEK_DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const WEEK_DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// Lunes de la semana 1 del programa (inicio real del entrenamiento).
// La semana 4 comenzó el lunes 2026-07-06.
const TRAINING_EPOCH = new Date('2026-06-15T00:00:00');

// Semana actual del programa, sin tope: el tracking continúa indefinidamente.
export function getCurrentWeek(): number {
  const diff = Math.floor((Date.now() - TRAINING_EPOCH.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, diff + 1);
}

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// "lun 6 ene"
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${WEEK_DAYS_SHORT[d.getDay()].toLowerCase()} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

// "Enero 2025"
export function formatMonthYear(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Lunes en que empieza una semana del programa. */
export function weekStartDate(week: number): Date {
  return new Date(TRAINING_EPOCH.getTime() + (week - 1) * 7 * 86400000);
}

/** "lun 13 jul" — cuándo arranca la semana indicada. */
export function weekStartLabel(week: number): string {
  return formatShortDate(weekStartDate(week).toISOString());
}

/** Días que faltan para que empiece la semana indicada (0 = ya empezó). */
export function daysUntilWeek(week: number): number {
  const start = weekStartDate(week);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((start.getTime() - today.getTime()) / 86400000));
}
