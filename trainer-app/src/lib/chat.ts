import { supabase } from './supabase';

// Cuenta mensajes sin leer que le llegaron al usuario actual en una conversación.
export async function unreadCount(coachId: string, clientId: string, meId: string): Promise<number> {
  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .neq('sender_id', meId)
    .is('read_at', null);
  return count ?? 0;
}
