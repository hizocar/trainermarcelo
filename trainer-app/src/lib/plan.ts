import { supabase } from './supabase';
import { Exercise, TrainingDay } from '../types';
import { getCurrentWeek } from './weeks';

// Carga completa del plan en UNA sola consulta anidada (antes: 5-6 encadenadas).
// En el gimnasio con señal mala, esto es la diferencia entre 3s y 0.5s.

// "Gestión de semanas": cada plan tiene una o más semanas (plan_weeks), cada
// una con sus propios días/ejercicios/series — 100% independientes entre sí.
// Ver supabase_migration_v17.sql para el porqué.
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
 *    planes creados antes de esta función siguen funcionando igual).
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

export async function fetchPlanWeeks(planId: string): Promise<PlanWeek[]> {
  const { data, error } = await supabase
    .from('plan_weeks').select('*')
    .eq('plan_id', planId).eq('archived', false)
    .order('week_number');
  if (error) throw new Error(`No se pudieron cargar las semanas del plan: ${error.message}`);
  return (data ?? []) as PlanWeek[];
}

export interface PlanSeries {
  id: string;
  series_number: number;
}

export interface PlanExercise extends Exercise {
  exercise_series: PlanSeries[];
}

export interface PlanDay extends TrainingDay {
  exercises: PlanExercise[];
}

export interface FullPlan {
  id: string;
  weeks: PlanWeek[];
  /** semana resuelta para el calendarWeek pedido, o null si el coach aún no la planificó */
  activeWeek: PlanWeek | null;
  days: PlanDay[];
  /** series_id → exercise_id */
  seriesToExercise: Record<string, string>;
  /** series_id → day_id */
  seriesToDay: Record<string, string>;
  /** todos los ids de series del plan */
  seriesIds: string[];
}

/**
 * Carga el plan de un cliente PARA UNA SEMANA CALENDARIO dada (por defecto,
 * la semana actual). Cada semana es independiente — si el coach no la
 * planificó y no hay una semana anterior marcada "repetir", `days` queda
 * vacío y `activeWeek` en null: la pantalla debe mostrar el estado
 * "tu coach aún no planificó esta semana" en vez de una lista vacía rara.
 */
export async function fetchFullPlan(clientId: string, calendarWeek: number = getCurrentWeek()): Promise<FullPlan | null> {
  const { data: planRow, error: planErr } = await supabase
    .from('workout_plans').select('id')
    .eq('client_id', clientId).maybeSingle();
  if (planErr || !planRow) return null;

  const weeks = await fetchPlanWeeks(planRow.id);
  const activeWeek = resolveActiveWeek(weeks, calendarWeek);

  let days: PlanDay[] = [];
  if (activeWeek) {
    const { data } = await supabase
      .from('training_days')
      .select(`
        id, plan_id, day_number, name, week_day, archived,
        exercises (
          id, day_id, name, name_en, muscle_group, superseries_group,
          reps_objective, unit, ref_weight, order_index, archived,
          image_url, video_url, notes, tempo, rest_seconds, target_rir,
          exercise_series ( id, series_number )
        )
      `)
      .eq('plan_week_id', activeWeek.id);

    // archivados fuera del plan activo (su historial sigue vivo en las vistas de historial)
    days = (data ?? [])
      .filter((d: any) => !d.archived)
      .map((d: any) => ({
        ...d,
        exercises: (d.exercises ?? [])
          .filter((e: any) => !e.archived)
          .slice()
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .map((e: any) => ({
            ...e,
            exercise_series: (e.exercise_series ?? [])
              .slice()
              .sort((a: PlanSeries, b: PlanSeries) => a.series_number - b.series_number),
          })),
      }))
      .sort((a: PlanDay, b: PlanDay) => a.day_number - b.day_number);
  }

  const seriesToExercise: Record<string, string> = {};
  const seriesToDay: Record<string, string> = {};
  const seriesIds: string[] = [];

  days.forEach(d => {
    d.exercises.forEach(e => {
      e.exercise_series.forEach(s => {
        seriesToExercise[s.id] = e.id;
        seriesToDay[s.id] = d.id;
        seriesIds.push(s.id);
      });
    });
  });

  return { id: planRow.id, weeks, activeWeek, days, seriesToExercise, seriesToDay, seriesIds };
}

/** Logs del plan (todos o de una semana concreta) en una sola consulta. */
export async function fetchLogs(seriesIds: string[], week?: number) {
  if (seriesIds.length === 0) return [];
  let q = supabase
    .from('workout_logs')
    .select('id, series_id, week_number, weight, reps, rir, logged_at')
    .in('series_id', seriesIds);
  if (week != null) q = q.eq('week_number', week);
  const { data } = await q;
  return data ?? [];
}

/** Días activos (excluye los marcados como libres). */
export function activeDays(days: PlanDay[]): PlanDay[] {
  return days.filter(d => !d.name.toLowerCase().includes('libre'));
}

/** Agrupa ejercicios por superserie conservando el orden del plan. */
export interface ExerciseGroup {
  key: string;
  superseries: string | null;
  exercises: PlanExercise[];
}

export function groupBySuperseries(exercises: PlanExercise[]): ExerciseGroup[] {
  const groups: ExerciseGroup[] = [];
  exercises.forEach(e => {
    const ss = e.superseries_group?.trim() || null;
    const last = groups[groups.length - 1];
    if (ss && last && last.superseries === ss) {
      last.exercises.push(e);
    } else {
      groups.push({ key: ss ? `ss-${ss}-${e.id}` : e.id, superseries: ss, exercises: [e] });
    }
  });
  return groups;
}
