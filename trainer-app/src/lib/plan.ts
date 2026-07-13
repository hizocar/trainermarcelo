import { supabase } from './supabase';
import { Exercise, TrainingDay } from '../types';

// Carga completa del plan en UNA sola consulta anidada (antes: 5-6 encadenadas).
// En el gimnasio con señal mala, esto es la diferencia entre 3s y 0.5s.

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
  days: PlanDay[];
  /** series_id → exercise_id */
  seriesToExercise: Record<string, string>;
  /** series_id → day_id */
  seriesToDay: Record<string, string>;
  /** todos los ids de series del plan */
  seriesIds: string[];
}

export async function fetchFullPlan(clientId: string): Promise<FullPlan | null> {
  const { data, error } = await supabase
    .from('workout_plans')
    .select(`
      id,
      training_days (
        id, plan_id, day_number, name, week_day,
        exercises (
          id, day_id, name, name_en, muscle_group, superseries_group,
          reps_objective, unit, ref_weight, order_index,
          image_url, video_url, notes, tempo, rest_seconds, target_rir,
          exercise_series ( id, series_number )
        )
      )
    `)
    .eq('client_id', clientId)
    .maybeSingle();

  if (error || !data) return null;

  const days: PlanDay[] = ((data as any).training_days ?? [])
    .map((d: any) => ({
      ...d,
      exercises: (d.exercises ?? [])
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

  return { id: (data as any).id, days, seriesToExercise, seriesToDay, seriesIds };
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
