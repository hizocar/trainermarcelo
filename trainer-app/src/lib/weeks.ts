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

/** Fecha exacta de un día de semana (0=Dom..6=Sáb) dentro de una semana del programa. */
export function dateForWeekDay(week: number, weekDay: number): Date {
  const monday = weekStartDate(week);
  const offset = weekDay === 0 ? 6 : weekDay - 1; // Lun=0 ... Dom=6
  return new Date(monday.getTime() + offset * 86400000);
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

// ── Calendario mensual (Tarea 9) ────────────────────────────────────────────
// Igual que la versión web (web/src/lib/weeks.ts), pero acá las fechas usan
// la zona horaria del teléfono (la del propio coach), no una zona fija de
// Chile: no hace falta convertir instantes con Intl, un Date local alcanza.

/**
 * A qué semana del programa pertenece una fecha, para el calendario. A
 * diferencia de un clamp a la semana 1, las fechas ANTERIORES al epoch
 * devuelven null: antes del epoch el programa no existía, no hay que
 * fabricar una semana 1 sobre meses de historia previos al alta del alumno.
 */
export function calendarWeekNumberForDate(date: Date): number | null {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = Math.floor((d.getTime() - TRAINING_EPOCH.getTime()) / (7 * 86400000));
  return diff < 0 ? null : diff + 1;
}

/** Las 7 fechas (lunes→domingo) de una semana de programa. */
export function weekDates(week: number): Date[] {
  const start = weekStartDate(week);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/** Clave "YYYY-MM-DD" de una fecha local (sin zona horaria que convertir). */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Filas de 7 días (lunes→domingo) que cubren el mes completo. `month` es
 * 0-indexado igual que en Date. Incluye días del mes anterior/siguiente para
 * completar la primera y la última fila.
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

/**
 * De los ejercicios de un día planificado, en qué días de su semana de
 * programa (weekDayKeys, lunes→domingo) hay al menos un registro — aparte
 * del propio día planificado (plannedKey). Sirve para decidir si un día
 * planificado sin registro ese día se "movió" a otro día de la semana.
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
