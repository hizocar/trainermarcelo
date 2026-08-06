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
