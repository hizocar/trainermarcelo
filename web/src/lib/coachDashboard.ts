import { clientStatus, type ClientStatus } from './clientStatus';
import { resolveActiveWeek, type PlanWeek } from './planWeeks';
import { getCurrentWeek, santiagoWeekDay, santiagoDayKey } from './weeks';

// Datos de la lista de alumnos del coach, cargados EN BLOQUE.
//
// Regla que no se puede romper: el número de consultas es fijo y ningún
// `.in(...)` recibe una lista que crezca con el número de series del plan.
// Los registros se piden por `logged_by` (un id por alumno, ~30) en vez de
// por `series_id` (miles) — pedirlos por serie es exactamente el error que
// hizo fallar en silencio al calendario y dibujar el mes como "nadie entrenó".

export interface CoachDashboardRow {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  status: ClientStatus;
  /** "YYYY-MM-DD" del último entrenamiento dentro de las 2 semanas miradas, o null */
  lastTrainedKey: string | null;
}

export async function loadCoachDashboard(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  coachId: string,
): Promise<CoachDashboardRow[]> {
  const { data: clients } = await supabase
    .from('users')
    .select('id, name, email, avatar_url')
    .eq('role', 'client')
    .eq('coach_id', coachId)
    .order('name');

  const list = (clients ?? []) as { id: string; name: string; email: string; avatar_url: string | null }[];
  if (list.length === 0) return [];

  const clientIds = list.map((c) => c.id);
  const currentWeek = getCurrentWeek();
  const todayWeekDay = santiagoWeekDay();

  // 1) planes de esos alumnos
  const { data: plans } = await supabase
    .from('workout_plans').select('id, client_id').in('client_id', clientIds);
  const planByClient = new Map<string, string>();
  (plans ?? []).forEach((p: any) => planByClient.set(p.client_id, p.id));
  const planIds = Array.from(planByClient.values());

  // 2) semanas de esos planes -> la activa de cada uno
  const { data: weeks } = planIds.length
    ? await supabase.from('plan_weeks').select('*').in('plan_id', planIds).eq('archived', false)
    : { data: [] };
  const weeksByPlan = new Map<string, PlanWeek[]>();
  ((weeks ?? []) as PlanWeek[]).forEach((w) => {
    weeksByPlan.set(w.plan_id, [...(weeksByPlan.get(w.plan_id) ?? []), w]);
  });
  const activeWeekByPlan = new Map<string, string>();
  planIds.forEach((planId) => {
    const active = resolveActiveWeek(weeksByPlan.get(planId) ?? [], currentWeek);
    if (active) activeWeekByPlan.set(planId, active.id);
  });

  // 3) días de las semanas activas, con sus ejercicios y series
  const activeWeekIds = Array.from(activeWeekByPlan.values());
  const { data: days } = activeWeekIds.length
    ? await supabase
        .from('training_days')
        .select('id, plan_id, name, week_day, archived, exercises ( id, archived, exercise_series ( id ) )')
        .in('plan_week_id', activeWeekIds)
    : { data: [] };

  // 4) registros de las 2 últimas semanas, acotados por ALUMNO (no por serie)
  const { data: logs, error: logsError } = await supabase
    .from('workout_logs')
    .select('series_id, logged_by, logged_at, week_number')
    .in('logged_by', clientIds)
    .in('week_number', [currentWeek - 1, currentWeek]);

  // Un fallo acá NO puede disfrazarse de "nadie entrenó": se propaga.
  if (logsError) throw new Error(`No se pudieron cargar los registros: ${logsError.message}`);

  // series_id -> día planificado
  const dayBySeries = new Map<string, { dayId: string; planId: string; weekDay: number | null }>();
  const plannedByPlan = new Map<string, number[]>();
  ((days ?? []) as any[])
    .filter((d) => !d.archived && !d.name.toLowerCase().includes('libre'))
    .forEach((d) => {
      if (d.week_day != null) {
        plannedByPlan.set(d.plan_id, [...(plannedByPlan.get(d.plan_id) ?? []), d.week_day]);
      }
      (d.exercises ?? []).filter((e: any) => !e.archived).forEach((e: any) => {
        (e.exercise_series ?? []).forEach((s: any) => {
          dayBySeries.set(s.id, { dayId: d.id, planId: d.plan_id, weekDay: d.week_day });
        });
      });
    });

  // Un día planificado está cumplido si ALGUNO de sus ejercicios tiene un
  // registro en la semana en curso — sin importar en qué día lo hizo, que es
  // el mismo criterio que usa el calendario.
  const completedByPlan = new Map<string, Set<number>>();
  const lastTrainedByClient = new Map<string, string>();
  ((logs ?? []) as any[]).forEach((l) => {
    if (l.logged_at) {
      const key = santiagoDayKey(new Date(l.logged_at));
      const prev = lastTrainedByClient.get(l.logged_by);
      if (!prev || key > prev) lastTrainedByClient.set(l.logged_by, key);
    }
    if (l.week_number !== currentWeek) return;
    const meta = dayBySeries.get(l.series_id);
    if (!meta || meta.weekDay == null) return;
    const set = completedByPlan.get(meta.planId) ?? new Set<number>();
    set.add(meta.weekDay);
    completedByPlan.set(meta.planId, set);
  });

  return list.map((c) => {
    const planId = planByClient.get(c.id);
    const hasPlan = !!planId && activeWeekByPlan.has(planId);
    return {
      ...c,
      status: clientStatus({
        hasPlan,
        plannedWeekDays: planId ? plannedByPlan.get(planId) ?? [] : [],
        completedWeekDays: planId ? Array.from(completedByPlan.get(planId) ?? []) : [],
        todayWeekDay,
      }),
      lastTrainedKey: lastTrainedByClient.get(c.id) ?? null,
    };
  });
}
