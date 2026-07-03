export type UserRole = 'coach' | 'client';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  coach_id?: string;
  email: string;
  avatar_url?: string;
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
  week_day?: number; // 0=Dom 1=Lun 2=Mar 3=Mié 4=Jue 5=Vie 6=Sáb
}

export interface Invitation {
  id: string;
  coach_id: string;
  email: string;
  name: string;
  status: 'pending' | 'accepted';
  created_at: string;
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
  image_url?: string;
  video_url?: string;
  notes?: string;
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

export interface BodyMetric {
  id: string;
  user_id: string;
  measured_at: string; // fecha YYYY-MM-DD
  weight_kg?: number;
  height_cm?: number;
  body_fat_pct?: number;
  notes?: string;
  photo_path?: string;
  created_at: string;
}
