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
