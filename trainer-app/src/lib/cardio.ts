import { supabase } from './supabase';

// Registro de cardio: libre del cliente, no depende del split de fuerza del
// coach — "hice 30 min de trote" cualquier día de la semana.

export const CARDIO_TYPES = ['Trote', 'Caminata', 'Bicicleta', 'Elíptica', 'Natación', 'Otro'];

export interface CardioLog {
  id: string;
  user_id: string;
  type: string;
  duration_minutes: number;
  logged_at: string;
  notes: string | null;
}

export async function fetchCardioLogs(userId: string, sinceDays = 7): Promise<CardioLog[]> {
  const since = new Date(Date.now() - sinceDays * 86400000).toISOString();
  const { data } = await supabase
    .from('cardio_logs').select('*')
    .eq('user_id', userId).gte('logged_at', since)
    .order('logged_at', { ascending: false });
  return data ?? [];
}

export async function addCardioLog(row: {
  user_id: string; type: string; duration_minutes: number; logged_at: string; notes?: string | null;
}) {
  return supabase.from('cardio_logs').insert(row).select().single();
}

export async function deleteCardioLog(id: string) {
  return supabase.from('cardio_logs').delete().eq('id', id);
}
