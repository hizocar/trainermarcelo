// "Gestión de semanas": cada plan tiene una o más semanas (plan_weeks),
// cada una con sus propios días/ejercicios/series — 100% independientes
// entre sí. Ver trainer-app/supabase_migration_v17.sql para el porqué.

export interface PlanWeek {
  id: string;
  plan_id: string;
  week_number: number;
  name: string;
  is_deload: boolean;
  repeat_forever: boolean;
  archived: boolean;
}

/**
 * Qué semana (plan_week) corresponde a una semana calendario dada.
 * 1) coincidencia exacta si existe.
 * 2) si no, la última semana ANTERIOR marcada repeat_forever=true (así los
 *    planes creados antes de esta función no se rompen: quedan con su única
 *    semana repitiéndose como siempre).
 * 3) si no hay ninguna: null — "tu coach aún no planificó esta semana".
 */
export function resolveActiveWeek(weeks: PlanWeek[], calendarWeek: number): PlanWeek | null {
  const active = weeks.filter(w => !w.archived);
  const exact = active.find(w => w.week_number === calendarWeek);
  if (exact) return exact;
  const fallback = active
    .filter(w => w.week_number < calendarWeek && w.repeat_forever)
    .sort((a, b) => b.week_number - a.week_number)[0];
  return fallback ?? null;
}

/**
 * El número que debe llevar una semana NUEVA (crear o duplicar).
 *
 * week_number es la semana CALENDARIO (se cuenta desde la época del
 * entrenamiento), no un correlativo del plan. Numerar "la siguiente de la
 * lista" (max + 1) en un plan cuya única semana es la 1 crea la semana 2 —
 * que ocurrió hace meses — y la app, que pide la semana de hoy, nunca la
 * muestra: el coach edita algo que su alumno jamás ve. Pasó de verdad
 * (Carolina Flores: "Semana 1 (copia)" con 5 ejercicios, invisible).
 *
 * Por eso una semana nueva nunca nace en el pasado: o es la de hoy, o la
 * siguiente libre.
 */
export function numeroNuevaSemana(weeks: { week_number: number; archived: boolean }[], semanaActual: number): number {
  const maximo = weeks.filter(w => !w.archived).reduce((m, w) => Math.max(m, w.week_number), 0);
  return Math.max(maximo + 1, semanaActual);
}
