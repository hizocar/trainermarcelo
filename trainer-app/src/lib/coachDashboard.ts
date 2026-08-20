import { supabase } from './supabase';
import { clientStatus, ClientStatus } from './clientStatus';
import { resolveActiveWeek, PlanWeek } from './plan';
import { getCurrentWeek } from './weeks';

// Estado de los alumnos del coach, cargado EN BLOQUE.
//
// Regla que no se puede romper: el número de consultas es fijo y ningún
// `.in(...)` recibe una lista que crezca con el número de series del plan —
// pedirlos por `series_id` (miles) es el error que ya hizo fallar en
// silencio al calendario.
//
// Los registros ya NO se acotan por `logged_by`: desde la v21 esa columna
// dice quién TECLEÓ el registro (puede ser el coach), no de quién es. La
// pertenencia se deriva del plan de la serie, y RLS ya limita lo que vuelve
// a los planes de los alumnos de quien consulta. Por eso el filtro se quita
// en vez de reemplazarse por una lista de series.
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
  /** mensajes que este alumno le mandó al coach y el coach todavía no leyó */
  unread: number;
  /** ¿tiene una fila en workout_plans? (no implica que tenga semana activa) */
  planExists: boolean;
  /** ¿esa fila (si existe) tiene una plan_week activa esta semana de programa? */
  activeWeekExists: boolean;
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
  const clientByPlan = new Map<string, string>();
  (plans ?? []).forEach((p: any) => {
    planByClient.set(p.client_id, p.id);
    clientByPlan.set(p.id, p.client_id);
  });
  const planIds = Array.from(planByClient.values());

  const { data: weeks, error: weeksError } = planIds.length
    ? await supabase.from('plan_weeks').select('*').in('plan_id', planIds).eq('archived', false)
    : { data: [], error: null };
  if (weeksError) throw new Error(`No se pudieron cargar las semanas: ${weeksError.message}`);
  const weeksByPlan = new Map<string, PlanWeek[]>();
  ((weeks ?? []) as PlanWeek[]).forEach(w => {
    weeksByPlan.set(w.plan_id, [...(weeksByPlan.get(w.plan_id) ?? []), w]);
  });
  // Se resuelve la semana en curso Y la anterior. NO simplificar esto a una
  // sola: los registros que se piden más abajo cubren DOS semanas, y en un
  // plan multi-semana (v17) las series de la semana pasada viven en otra
  // plan_week. Si no se cargan sus días, ese registro no se puede atribuir a
  // nadie y un alumno que entrenó la semana pasada aparece como "sin
  // registros en 2 semanas". Son 2 ids por plan, tamaño fijo: la lista no
  // crece con el número de series.
  const activeWeekByPlan = new Map<string, string>();
  const prevWeekByPlan = new Map<string, string>();
  planIds.forEach(planId => {
    const weeksOfPlan = weeksByPlan.get(planId) ?? [];
    const active = resolveActiveWeek(weeksOfPlan, currentWeek);
    if (active) activeWeekByPlan.set(planId, active.id);
    const previa = resolveActiveWeek(weeksOfPlan, currentWeek - 1);
    if (previa) prevWeekByPlan.set(planId, previa.id);
  });

  const activeWeekIds = Array.from(activeWeekByPlan.values());
  const activeWeekIdSet = new Set(activeWeekIds);
  const weekIdsToLoad = Array.from(new Set([...activeWeekIds, ...prevWeekByPlan.values()]));
  const { data: days, error: daysError } = weekIdsToLoad.length
    ? await supabase
        .from('training_days')
        .select('id, plan_id, plan_week_id, name, week_day, archived, exercises ( id, archived, exercise_series ( id ) )')
        .in('plan_week_id', weekIdsToLoad)
    : { data: [], error: null };
  if (daysError) throw new Error(`No se pudieron cargar los días de entrenamiento: ${daysError.message}`);

  // Registros de las 2 últimas semanas. Sin filtro por alumno: RLS los acota
  // a los planes de los alumnos de este coach.
  const { data: logs, error: logsError } = await supabase
    .from('workout_logs')
    .select('series_id, logged_at, week_number')
    .in('week_number', [currentWeek - 1, currentWeek]);

  // Un fallo acá NO puede disfrazarse de "nadie entrenó".
  if (logsError) throw new Error(`No se pudieron cargar los registros: ${logsError.message}`);

  // 5) mensajes sin leer, acotados por ALUMNO igual que los registros (una
  // sola consulta, no una por alumno) — "sin leer" es lo que el coach todavía
  // no vio: llegó del alumno (sender_id != coachId) y no tiene read_at.
  const { data: unreadRows, error: unreadError } = await supabase
    .from('messages')
    .select('client_id')
    .eq('coach_id', coachId)
    .in('client_id', clientIds)
    .neq('sender_id', coachId)
    .is('read_at', null);
  if (unreadError) throw new Error(`No se pudieron cargar los mensajes: ${unreadError.message}`);
  const unreadByClient = new Map<string, number>();
  ((unreadRows ?? []) as any[]).forEach(r => {
    unreadByClient.set(r.client_id, (unreadByClient.get(r.client_id) ?? 0) + 1);
  });

  // series_id -> plan, SIN filtrar: para saber de quién es un registro da lo
  // mismo que su día esté archivado o se llame "libre". Se arma aparte de
  // `dayBySeries` justamente para que el filtro de abajo no le quite
  // entrenamientos a la fecha de "última vez que entrenó".
  const planBySeries = new Map<string, string>();
  ((days ?? []) as any[]).forEach(d => {
    (d.exercises ?? []).forEach((e: any) => {
      (e.exercise_series ?? []).forEach((s: any) => planBySeries.set(s.id, d.plan_id));
    });
  });

  // Lo planificado y lo cumplido son SIEMPRE de la semana en curso: acá los
  // días de la semana anterior se descartan (solo estaban para atribuir).
  const dayBySeries = new Map<string, { planId: string; weekDay: number | null }>();
  const plannedByPlan = new Map<string, number[]>();
  ((days ?? []) as any[])
    .filter(d => activeWeekIdSet.has(d.plan_week_id))
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
      // De quién es el registro sale del plan de la serie, no de quién lo
      // tecleó: un registro que anotó el coach igual es del alumno.
      const clienteId = clientByPlan.get(planBySeries.get(l.series_id) ?? '');
      if (clienteId) {
        const key = dayKey(new Date(l.logged_at));
        const prev = lastTrainedByClient.get(clienteId);
        if (!prev || key > prev) lastTrainedByClient.set(clienteId, key);
      }
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
    const planExists = !!planId;
    const activeWeekExists = !!planId && activeWeekByPlan.has(planId);
    return {
      ...c,
      status: clientStatus({
        hasPlan: activeWeekExists,
        plannedWeekDays: planId ? plannedByPlan.get(planId) ?? [] : [],
        completedWeekDays: planId ? Array.from(completedByPlan.get(planId) ?? []) : [],
        todayWeekDay,
      }),
      lastTrainedKey: lastTrainedByClient.get(c.id) ?? null,
      unread: unreadByClient.get(c.id) ?? 0,
      planExists,
      activeWeekExists,
    };
  });
}
