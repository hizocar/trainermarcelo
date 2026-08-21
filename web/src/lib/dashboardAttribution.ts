// De quién es un registro, y qué días de la semana quedaron cumplidos.
//
// Estaba escrito a mano dentro de loadCoachDashboard en los dos proyectos, sin
// tests, porque vivía pegado a una función async que recibe el cliente de
// Supabase. Acá queda puro para poder probarlo.
//
// Espejo exacto de trainer-app/src/lib/dashboardAttribution.ts — los valores
// deben coincidir para las mismas entradas.

export interface DiaPlanificado {
  id: string;
  plan_id: string;
  name: string;
  /** numeración de JavaScript: 0=Dom … 6=Sáb */
  week_day: number | null;
  archived?: boolean;
  exercises?: { archived?: boolean; exercise_series?: { id: string }[] }[];
}

export interface RegistroCrudo {
  series_id: string;
  logged_at: string | null;
  week_number: number;
  /** el plan embebido, subiendo serie -> ejercicio -> día */
  exercise_series?: unknown;
}

export interface AtribucionInput {
  days: DiaPlanificado[];
  logs: RegistroCrudo[];
  /** plan_id -> client_id */
  clientByPlan: Map<string, string>;
  currentWeek: number;
  /** cómo se nombra un día: la web usa hora de Santiago, la app la local */
  dayKey: (d: Date) => string;
}

export interface Atribucion {
  /** plan_id -> días planificados */
  plannedByPlan: Map<string, number[]>;
  /** plan_id -> días planificados que ya tienen algún registro esta semana */
  completedByPlan: Map<string, Set<number>>;
  /** client_id -> último día con registro */
  lastTrainedByClient: Map<string, string>;
}

/**
 * El plan al que pertenece un registro, subiendo por el embebido.
 *
 * PostgREST devuelve el embebido de una relación a-uno como objeto, pero según
 * la versión puede llegar envuelto en un arreglo: se aceptan las dos formas.
 */
export function planIdDelLog(l: unknown): string {
  const unwrap = (v: any) => (Array.isArray(v) ? v[0] : v);
  const log = l as any;
  return unwrap(unwrap(unwrap(log?.exercise_series)?.exercises)?.training_days)?.plan_id ?? '';
}

export function atribuirRegistros(
  { days, logs, clientByPlan, currentWeek, dayKey }: AtribucionInput,
): Atribucion {
  // series_id -> día planificado. Todos los días que entran son de la semana
  // en curso: lo planificado y lo cumplido son SIEMPRE de esta semana.
  const dayBySeries = new Map<string, { planId: string; weekDay: number | null }>();
  const plannedByPlan = new Map<string, number[]>();

  days
    .filter((d) => !d.archived && !d.name.toLowerCase().includes('libre'))
    .forEach((d) => {
      if (d.week_day != null) {
        plannedByPlan.set(d.plan_id, [...(plannedByPlan.get(d.plan_id) ?? []), d.week_day]);
      }
      (d.exercises ?? []).filter((e) => !e.archived).forEach((e) => {
        (e.exercise_series ?? []).forEach((s) => {
          dayBySeries.set(s.id, { planId: d.plan_id, weekDay: d.week_day });
        });
      });
    });

  // Un día planificado está cumplido si ALGUNO de sus ejercicios tiene un
  // registro en la semana en curso — sin importar en qué día lo hizo, que es
  // el mismo criterio que usa el calendario.
  const completedByPlan = new Map<string, Set<number>>();
  const lastTrainedByClient = new Map<string, string>();

  logs.forEach((l) => {
    if (l.logged_at) {
      // De quién es el registro sale del plan de la serie, no de quién lo
      // tecleó: un registro que anotó el coach igual es del alumno.
      const clienteId = clientByPlan.get(planIdDelLog(l));
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

  return { plannedByPlan, completedByPlan, lastTrainedByClient };
}
