import { clientStatus, type ClientStatus } from './clientStatus';
import { resolveActiveWeek, type PlanWeek } from './planWeeks';
import { santiagoCurrentWeek, santiagoWeekDay, santiagoDayKey } from './weeks';
import { atribuirRegistros } from './dashboardAttribution';

// Datos de la lista de alumnos del coach, cargados EN BLOQUE.
//
// Regla que no se puede romper: el número de consultas es fijo y ningún
// `.in(...)` recibe una lista que crezca con el número de series del plan —
// pedir los registros por `series_id` (miles) es exactamente el error que
// hizo fallar en silencio al calendario y dibujar el mes como "nadie entrenó".
//
// Los registros ya NO se acotan por `logged_by`: desde la v21 esa columna
// dice quién TECLEÓ el registro (puede ser el coach), no de quién es. La
// pertenencia se deriva del plan de la serie, y RLS ya limita lo que vuelve
// a los planes de los alumnos de quien consulta. Por eso el filtro se quita
// en vez de reemplazarse por una lista de series.

export interface CoachDashboardRow {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  status: ClientStatus;
  /** "YYYY-MM-DD" del último entrenamiento dentro de las 2 semanas miradas, o null */
  lastTrainedKey: string | null;
  /** ¿tiene una fila en workout_plans? (no implica que tenga semana activa) */
  planExists: boolean;
  /** ¿esa fila (si existe) tiene una plan_week activa esta semana de programa? */
  activeWeekExists: boolean;
}

export async function loadCoachDashboard(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  coachId: string,
): Promise<CoachDashboardRow[]> {
  const { data: clients, error: clientsError } = await supabase
    .from('users')
    .select('id, name, email, avatar_url')
    .eq('role', 'client')
    .eq('coach_id', coachId)
    .order('name');
  if (clientsError) throw new Error(`No se pudieron cargar los alumnos: ${clientsError.message}`);

  const list = (clients ?? []) as { id: string; name: string; email: string; avatar_url: string | null }[];
  if (list.length === 0) return [];

  const clientIds = list.map((c) => c.id);
  // OJO: NO usar getCurrentWeek() acá (ver santiagoCurrentWeek en weeks.ts) —
  // mide desde Date.now() en la zona del runtime (UTC en Vercel), y quedaría
  // desincronizado de `todayWeekDay` cada domingo de noche en Chile.
  const currentWeek = santiagoCurrentWeek();
  const todayWeekDay = santiagoWeekDay();

  // 1) planes de esos alumnos
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

  // 2) semanas de esos planes -> la activa de cada uno
  const { data: weeks, error: weeksError } = planIds.length
    ? await supabase.from('plan_weeks').select('*').in('plan_id', planIds).eq('archived', false)
    : { data: [], error: null };
  if (weeksError) throw new Error(`No se pudieron cargar las semanas: ${weeksError.message}`);
  const weeksByPlan = new Map<string, PlanWeek[]>();
  ((weeks ?? []) as PlanWeek[]).forEach((w) => {
    weeksByPlan.set(w.plan_id, [...(weeksByPlan.get(w.plan_id) ?? []), w]);
  });
  // Se resuelve SOLO la semana en curso: es lo único que hace falta para saber
  // qué está planificado y qué se cumplió. La atribución de los registros ya
  // no pasa por acá — cada registro trae su plan, más abajo.
  const activeWeekByPlan = new Map<string, string>();
  planIds.forEach((planId) => {
    const active = resolveActiveWeek(weeksByPlan.get(planId) ?? [], currentWeek);
    if (active) activeWeekByPlan.set(planId, active.id);
  });

  // 3) días de esas semanas, con sus ejercicios y series
  const activeWeekIds = Array.from(activeWeekByPlan.values());
  const { data: days, error: daysError } = activeWeekIds.length
    ? await supabase
        .from('training_days')
        .select('id, plan_id, name, week_day, archived, exercises ( id, archived, exercise_series ( id ) )')
        .in('plan_week_id', activeWeekIds)
    : { data: [], error: null };
  if (daysError) throw new Error(`No se pudieron cargar los días de entrenamiento: ${daysError.message}`);

  // 4) registros de las 2 últimas semanas. Sin filtro por alumno: RLS los
  // acota a los planes de los alumnos de este coach.
  //
  // El plan de cada registro viene EN LA MISMA CONSULTA, subiendo por las
  // claves foráneas. No es un `.in(series_id, ...)`: la lista de filtros sigue
  // sin crecer con el número de series del plan.
  const { data: logs, error: logsError } = await supabase
    .from('workout_logs')
    .select(
      'series_id, logged_at, week_number, ' +
      'exercise_series ( exercises ( training_days ( plan_id ) ) )',
    )
    .in('week_number', [currentWeek - 1, currentWeek]);

  // Un fallo acá NO puede disfrazarse de "nadie entrenó": se propaga.
  if (logsError) throw new Error(`No se pudieron cargar los registros: ${logsError.message}`);

  // La atribución —de quién es cada registro y qué días quedaron cumplidos—
  // vive en dashboardAttribution.ts, pura y con tests, espejo de la copia de
  // trainer-app. Estaba escrita a mano acá y en la app, sin tests, que es
  // justo lo que el CLAUDE.md no quiere: dos copias que pueden divergir.
  const { plannedByPlan, completedByPlan, lastTrainedByClient } = atribuirRegistros({
    days: (days ?? []) as any[],
    logs: (logs ?? []) as any[],
    clientByPlan,
    currentWeek,
    dayKey: santiagoDayKey,
  });

  return list.map((c) => {
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
      planExists,
      activeWeekExists,
    };
  });
}
