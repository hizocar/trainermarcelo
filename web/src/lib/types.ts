export type UserRole = 'coach' | 'client' | 'coach_pending';

export interface AppUser {
  id: string;
  name: string;
  role: UserRole;
  coach_id?: string;
  email: string;
  avatar_url?: string;
  is_owner?: boolean;
}

export interface TrainingDay {
  id: string;
  plan_id: string;
  day_number: number;
  name: string;
  week_day?: number | null;
}

export interface ExerciseSeries {
  id: string;
  exercise_id: string;
  series_number: number;
}

export interface Exercise {
  id: string;
  day_id: string;
  name: string;
  name_en?: string | null;
  muscle_group?: string | null;
  superseries_group?: string | null;
  reps_objective: string;
  unit: 'kg' | 'lb';
  ref_weight?: number | null;
  order_index: number;
  notes?: string | null;
  tempo?: string | null;
  rest_seconds?: number | null;
  target_rir?: string | null;
  exercise_series?: ExerciseSeries[];
}

export interface PlanDay extends TrainingDay {
  exercises: Exercise[];
}
