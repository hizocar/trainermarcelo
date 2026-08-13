import { supabase } from './supabase';
import { clientStatus, ClientStatus } from './clientStatus';
import { resolveActiveWeek, PlanWeek } from './plan';
import { getCurrentWeek } from './weeks';

// Estado de los alumnos del coach, cargado EN BLOQUE.
//
// Regla que no se puede romper: el número de consultas es fijo y ningún
// `.in(...)` recibe una lista que crezca con el número de series del plan.
// Los registros se piden por `logged_by` (un id por alumno) en vez de por
// `series_id` (miles).
//
// A diferencia de la web, acá las fechas usan la zona del teléfono, que es
// la del propio coach — igual que el resto de la app.

export interface CoachDashboardRow {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  status: ClientStatus;
  /** "YYYY-MM-DD" del último entrenamiento dentro de las 2 semanas miradas, o null */
  lastTrainedKey: string | null;
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function loadCoachDashboard(coachId: string): Promise<CoachDashboardRow[]> {
  const { data: clients, error: clientsError } = await supabase
    .from('users').select('id, name, email, avatar_url')
    .eq('role', 'client').eq('coach_id', coachId).order('name');
  if (clientsError) throw new Error(`No se pudieron cargar los alumnos: ${clientsError.message}`);

  // Ojo: lo que vuelve de la consulta NO es todavía un CoachDashboardRow —
  // le faltan `status` y `lastTrainedKey`, que se calculan más abajo.
  const list = (clients ?? []) as { id: string; name: string; email: string; avatar_url: string | null }[];
  if (list.length === 0) return [];

  const clientIds = list.map(c => c.id);
  const currentWeek = getCurrentWeek();
  const todayWeekDay = new Date().getDay();

  const { data: plans, error: plansError } = await supabase
    .from('workout_plans').select('id, client_id').in('client_id', clientIds);
  if (plansError) throw new Error(`No se pudieron cargar los planes: ${plansError.message}`);
  const planByClient = new Map<string, string>();
  (plans ?? []).forEach((p: any) => planByClient.set(p.client_id, p.id));
  const planIds = Array.from(planByClient.values());

  const { data: weeks, error: weeksError } = planIds.length
    ? await supabase.from('plan_weeks').select('*').in('plan_id', planIds).eq('archived', false)
    : { data: [], error: null };
  if (weeksError) throw new Error(`No se pudieron cargar las semanas: ${weeksError.message}`);
  const weeksByPlan = new Map<string, PlanWeek[]>();
  ((weeks ?? []) as PlanWeek[]).forEach(w => {
    weeksByPlan.set(w.plan_id, [...(weeksByPlan.get(w.plan_id) ?? []), w]);
  });
  const activeWeekByPlan = new Map<string, string>();
  planIds.forEach(planId => {
    const active = resolveActiveWeek(weeksByPlan.get(planId) ?? [], currentWeek);
    if (active) activeWeekByPlan.set(planId, active.id);
  });

  const activeWeekIds = Array.from(activeWeekByPlan.values());
  const { data: days, error: daysError } = activeWeekIds.length
    ? await supabase
        .from('training_days')
        .select('id, plan_id, name, week_day, archived, exercises ( id, archived, exercise_series ( id ) )')
        .in('plan_week_id', activeWeekIds)
    : { data: [], error: null };
  if (daysError) throw new Error(`No se pudieron cargar los días de entrenamiento: ${daysError.message}`);

  const { data: logs, error: logsError } = await supabase
    .from('workout_logs')
    .select('series_id, logged_by, logged_at, week_number')
    .in('logged_by', clientIds)
    .in('week_number', [currentWeek - 1, currentWeek]);

  // Un fallo acá NO puede disfrazarse de "nadie entrenó".
  if (logsError) throw new Error(`No se pudieron cargar los registros: ${logsError.message}`);

  const dayBySeries = new Map<string, { planId: string; weekDay: number | null }>();
  const plannedByPlan = new Map<string, number[]>();
  ((days ?? []) as any[])
    .filter(d => !d.archived && !d.name.toLowerCase().includes('libre'))
    .forEach(d => {
      if (d.week_day != null) {
        plannedByPlan.set(d.plan_id, [...(plannedByPlan.get(d.plan_id) ?? []), d.week_day]);
      }
      (d.exercises ?? []).filter((e: any) => !e.archived).forEach((e: any) => {
        (e.exercise_series ?? []).forEach((s: any) => {
          dayBySeries.set(s.id, { planId: d.plan_id, weekDay: d.week_day });
        });
      });
    });

  const completedByPlan = new Map<string, Set<number>>();
  const lastTrainedByClient = new Map<string, string>();
  ((logs ?? []) as any[]).forEach(l => {
    if (l.logged_at) {
      const key = dayKey(new Date(l.logged_at));
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

  return list.map(c => {
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
