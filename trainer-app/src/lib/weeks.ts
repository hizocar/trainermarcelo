export const WEEK_DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const WEEK_DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// Lunes de la semana 1 del programa. Los logs históricos (semanas 1-8) usan este epoch.
const TRAINING_EPOCH = new Date('2025-01-06T00:00:00');

// Semana actual del programa, sin tope: el tracking continúa indefinidamente.
export function getCurrentWeek(): number {
  const diff = Math.floor((Date.now() - TRAINING_EPOCH.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, diff + 1);
}
