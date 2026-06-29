export type UserRole = 'coach' | 'client';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  coach_id?: string;
  email: string;
}

export interface WorkoutPlan {
  id: string;
  client_id: string;
  name: string;
  created_by: string;
}

export interface TrainingDay {
  id: string;
  plan_id: string;
  day_number: number;
  name: string;
}

export interface Exercise {
  id: string;
  day_id: string;
  name: string;
  superseries_group?: string;
  reps_objective: string;
  unit: 'kg' | 'lb';
  ref_weight?: number;
  order_index: number;
}

export interface ExerciseSeries {
  id: string;
  exercise_id: string;
  series_number: number;
}

export interface WorkoutLog {
  id: string;
  series_id: string;
  week_number: number;
  weight: number;
  reps: number;
  logged_at: string;
  logged_by: string;
}

export interface WeeklyVolume {
  week: number;
  volume: number;
}
