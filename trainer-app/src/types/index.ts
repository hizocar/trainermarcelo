export type UserRole = 'coach' | 'client' | 'coach_pending';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  coach_id?: string;
  email: string;
  avatar_url?: string;
  is_owner?: boolean;
  gym_id?: string;
  gymStatus?: string; // subscription_status del gimnasio, calculado en AuthContext (no viene de la tabla users)
}

export interface Gym {
  id: string;
  name: string;
  owner_id: string;
  plan_tier: string;
  coach_limit: number;
  created_at: string;
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
  // la columna es texto anulable: Supabase devuelve null cuando el ejercicio
  // está suelto, y encadenar/desencadenar escribe null explícitamente
  superseries_group?: string | null;
  reps_objective: string;
  unit: 'kg' | 'lb';
  ref_weight?: number;
  order_index: number;
  image_url?: string;
  video_url?: string;
  notes?: string;
  muscle_group?: string;
  name_en?: string;
  library_id?: string;
  tempo?: string;
  rest_seconds?: number;
  target_rir?: string;
}

export interface MoodLog {
  id: string;
  user_id: string;
  mood: string;
  logged_date: string; // YYYY-MM-DD
  created_at: string;
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
  rir?: number;
  logged_at: string;
  logged_by: string;
}

export interface SessionNote {
  id: string;
  user_id: string;
  day_id: string;
  week_number: number;
  note: string;
  created_at: string;
}

export interface DayTemplate {
  id: string;
  coach_id: string;
  name: string;
  exercises: any[];
  created_at: string;
}

export type MesoPhase = 'acumulacion' | 'intensificacion' | 'descarga';

export interface WeekPhase {
  id: string;
  plan_id: string;
  week_number: number;
  phase: MesoPhase;
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

export interface Message {
  id: string;
  coach_id: string;
  client_id: string;
  sender_id: string;
  body: string | null;
  media_type?: 'image' | 'audio' | null;
  media_path?: string | null;
  created_at: string;
  read_at?: string | null;
}
