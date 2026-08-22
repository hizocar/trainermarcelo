// Registro de eventos de uso — el transporte.
//
// track() nunca puede romper la app ni frenarla: encola en memoria, persiste
// la cola en AsyncStorage (sobrevive reinicios) y un ciclo la vacía por lotes
// contra app_events. Sin sesión no se envía (RLS lo exigiría igual); si un
// lote falla, se reintenta en el próximo ciclo. Todo es fire-and-forget.

import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { supabase } from './supabase';
import { encolar, tomarLote, EventoUso } from './analyticsQueue';

const STORAGE_KEY = 'app_events_queue_v1';
const FLUSH_MS = 15_000;

let cola: EventoUso[] = [];
let enviando = false;
let iniciado = false;

/** El único punto de entrada: analytics.track('sesion_terminada', { segundos }). */
export function track(name: string, props: Record<string, unknown> = {}): void {
  try {
    cola = encolar(cola, { name, props, occurred_at: new Date().toISOString() });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cola)).catch(() => {});
  } catch {
    // la telemetría jamás es más importante que lo que el usuario está haciendo
  }
}

async function flush(): Promise<void> {
  if (enviando || cola.length === 0) return;
  enviando = true;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // sin sesión no hay a quién atribuir: la cola espera
    const { lote, resto } = tomarLote(cola);
    const filas = lote.map(e => ({
      user_id: user.id,
      name: e.name,
      props: e.props,
      occurred_at: e.occurred_at,
      platform: Platform.OS,
      app_version: Constants.expoConfig?.version ?? null,
    }));
    const { error } = await supabase.from('app_events').insert(filas);
    if (error) return; // el lote queda en la cola y se reintenta al próximo ciclo
    cola = resto;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cola));
  } catch {
    // ídem: reintento silencioso en el próximo ciclo
  } finally {
    enviando = false;
  }
}

/** Se llama una vez, desde la raíz de la app. */
export function initAnalytics(): void {
  if (iniciado) return;
  iniciado = true;
  AsyncStorage.getItem(STORAGE_KEY)
    .then(crudo => {
      if (!crudo) return;
      // lo persistido se antepone: es más viejo que lo que llegue ahora
      const previa = JSON.parse(crudo) as EventoUso[];
      if (Array.isArray(previa)) cola = [...previa, ...cola].slice(-500);
    })
    .catch(() => {});
  setInterval(flush, FLUSH_MS);
  // al irse a segundo plano se intenta vaciar: es el último momento seguro
  AppState.addEventListener('change', estado => {
    if (estado === 'background') flush();
  });
}
