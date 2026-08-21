import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';
import { buildLogUpdate } from './logPayload';

// Cola de escrituras que sobrevive sin señal (el gimnasio suele ser un sótano).
// Los registros se guardan localmente y se suben en cuanto vuelve la conexión.

const QUEUE_KEY = 'offline_queue_v1';

export interface QueuedLog {
  id: string;                 // uuid local, para deduplicar
  series_id: string;
  week_number: number;
  weight: number;
  reps: number;
  rir: number | null;
  logged_by: string;
  logged_at: string;
  queued_at: number;
}

type Listener = (pending: number) => void;
const listeners = new Set<Listener>();

function notify(n: number) {
  listeners.forEach(l => l(n));
}

export function onQueueChange(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

async function readQueue(): Promise<QueuedLog[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeQueue(q: QueuedLog[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  notify(q.length);
}

export async function pendingCount(): Promise<number> {
  return (await readQueue()).length;
}

/** Encola un registro (una serie de una semana). Reemplaza el previo de la misma serie+semana. */
export async function enqueueLog(log: Omit<QueuedLog, 'id' | 'queued_at'>): Promise<void> {
  const q = await readQueue();
  const filtered = q.filter(
    x => !(x.series_id === log.series_id && x.week_number === log.week_number),
  );
  filtered.push({
    ...log,
    id: `${log.series_id}:${log.week_number}`,
    queued_at: Date.now(),
  });
  await writeQueue(filtered);
}

async function isOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return !!state.isConnected && state.isInternetReachable !== false;
  } catch {
    return true; // ante la duda, intentamos: el error de red se maneja abajo
  }
}

/**
 * Sube un registro. Si no hay red (o falla la escritura), lo encola y
 * devuelve 'queued' — la UI puede seguir como si se hubiera guardado.
 */
export async function saveLog(log: Omit<QueuedLog, 'id' | 'queued_at'>): Promise<'saved' | 'queued'> {
  if (!(await isOnline())) {
    await enqueueLog(log);
    return 'queued';
  }
  try {
    const { error } = await upsertLog(log);
    if (error) throw new Error(error.message);
    return 'saved';
  } catch {
    await enqueueLog(log);
    return 'queued';
  }
}

async function upsertLog(log: Omit<QueuedLog, 'id' | 'queued_at'>) {
  const { data: existing } = await supabase
    .from('workout_logs')
    .select('id')
    .eq('series_id', log.series_id)
    .eq('week_number', log.week_number)
    .maybeSingle();

  return existing
    ? await supabase.from('workout_logs').update(buildLogUpdate(log)).eq('id', existing.id)
    : await supabase.from('workout_logs').insert({
        series_id: log.series_id,
        week_number: log.week_number,
        weight: log.weight,
        reps: log.reps,
        rir: log.rir,
        logged_at: log.logged_at,
        logged_by: log.logged_by,
      });
}

/** Sube todo lo pendiente. Devuelve cuántos quedaron sin subir. */
export async function flushQueue(): Promise<number> {
  const q = await readQueue();
  if (q.length === 0) return 0;
  if (!(await isOnline())) return q.length;

  const failed: QueuedLog[] = [];
  for (const log of q) {
    try {
      const { error } = await upsertLog(log);
      if (error) failed.push(log);
    } catch {
      failed.push(log);
    }
  }
  await writeQueue(failed);
  return failed.length;
}

/** Arranca el sincronizador: intenta subir al recuperar la conexión. */
export function startSync(): () => void {
  flushQueue();
  const unsub = NetInfo.addEventListener(state => {
    if (state.isConnected && state.isInternetReachable !== false) flushQueue();
  });
  return unsub;
}
