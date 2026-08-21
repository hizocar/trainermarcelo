import { supabase } from './supabase';
import { clientStatus, ClientStatus } from './clientStatus';
import { resolveActiveWeek, PlanWeek } from './plan';
import { getCurrentWeek } from './weeks';
import { atribuirRegistros } from './dashboardAttribution';

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
  // Se resuelve SOLO la semana en curso: es lo único que hace falta para saber
  // qué está planificado y qué se cumplió. La atribución de los registros ya
  // no pasa por acá — cada registro trae su plan, más abajo.
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

  // Registros de las 2 últimas semanas. Sin filtro por alumno: RLS los acota
  // a los planes de los alumnos de este coach.
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

  // La atribución —de quién es cada registro y qué días quedaron cumplidos—
  // vive en dashboardAttribution.ts, pura y con tests, espejo de la copia de
  // web. Estaba escrita a mano acá y en la web, sin tests, que es justo lo que
  // el CLAUDE.md no quiere: dos copias que pueden divergir.
  const { plannedByPlan, completedByPlan, lastTrainedByClient } = atribuirRegistros({
    days: (days ?? []) as any[],
    logs: (logs ?? []) as any[],
    clientByPlan,
    currentWeek,
    dayKey,
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
