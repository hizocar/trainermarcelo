import { Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// Recordatorios locales (no requieren servidor).
//
// Se reprograman cada vez que se abre la app o se guarda un entrenamiento:
// así nunca avisan de un día que ya está completado. Por eso usamos avisos
// puntuales para los próximos 7 días en vez de repeticiones semanales fijas.

const ENABLED_KEY = 'notif_enabled_v1';
/**
 * Marca del aviso de "fin de descanso" (WorkoutLogScreen). Va en
 * `content.data.kind` para poder distinguirlo de los recordatorios y NO
 * borrarlo al reprogramarlos. Ver `cancelarSoloRecordatorios()`.
 */
const REST_KIND = 'rest';
const TRAIN_HOUR_KEY = 'notif_train_hour_v1';
const MOOD_HOUR_KEY = 'notif_mood_hour_v1';

export const DEFAULT_TRAIN_HOUR = 18; // 18:00
export const DEFAULT_MOOD_HOUR = 9;   // 09:00

export interface ReminderDay {
  id: string;
  day_number: number;
  name: string;
  week_day?: number | null;
  /** ya completado en la semana en curso: no se avisa */
  done?: boolean;
}

// Canal de Android para los mensajes de chat (iOS lo ignora)
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('chat', {
    name: 'Mensajes',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

Notifications.setNotificationHandler({
  handleNotification: async notification => {
    // El aviso de fin de descanso está agendado para el instante exacto del
    // término, así que iOS lo entrega antes de que el tick (cada 500ms) alcance
    // a cancelarlo: la cancelación SIEMPRE llega tarde con la app abierta. Si
    // lo dejáramos mostrarse, cada descanso terminado dejaría un banner y una
    // entrada en el Centro de Notificaciones encima de la serie que el alumno
    // ya está haciendo. Con la app en primer plano el háptico ya avisa, así que
    // lo silenciamos; con la app en segundo plano se muestra normal, que es
    // justo para lo que existe.
    const esDescanso =
      (notification.request.content.data as any)?.kind === REST_KIND;
    const enPrimerPlano = AppState.currentState === 'active';
    const mostrar = !(esDescanso && enPrimerPlano);
    return {
      shouldShowBanner: mostrar,
      shouldShowList: mostrar,
      shouldPlaySound: false,
      shouldSetBadge: false,
    };
  },
});

export async function notificationsEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(ENABLED_KEY)) === '1';
}

export async function getHours(): Promise<{ trainHour: number; moodHour: number }> {
  const [t, m] = await Promise.all([
    AsyncStorage.getItem(TRAIN_HOUR_KEY),
    AsyncStorage.getItem(MOOD_HOUR_KEY),
  ]);
  const th = t ? parseInt(t, 10) : NaN;
  const mh = m ? parseInt(m, 10) : NaN;
  return {
    trainHour: isNaN(th) ? DEFAULT_TRAIN_HOUR : th,
    moodHour: isNaN(mh) ? DEFAULT_MOOD_HOUR : mh,
  };
}

export async function setHours(trainHour: number, moodHour: number): Promise<void> {
  await AsyncStorage.setItem(TRAIN_HOUR_KEY, String(trainHour));
  await AsyncStorage.setItem(MOOD_HOUR_KEY, String(moodHour));
}

async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'web' || !Device.isDevice) return false;
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const { status: asked } = await Notifications.requestPermissionsAsync();
  return asked === 'granted';
}

/** Próxima fecha (a partir de mañana o de hoy si aún no pasa la hora) para un día de la semana. */
function nextDateFor(weekDay: number, hour: number): Date | null {
  const now = new Date();
  for (let offset = 0; offset < 7; offset++) {
    const d = new Date(now);
    d.setDate(now.getDate() + offset);
    d.setHours(hour, 0, 0, 0);
    if (d.getDay() === weekDay && d.getTime() > now.getTime() + 60000) return d;
  }
  return null;
}

/**
 * Reprograma todos los recordatorios.
 *  - entrenamiento: solo los días del plan que NO estén completados
 *  - encuesta de energía: cada día a la hora elegida
 * Llamar al abrir la app y al guardar un entrenamiento.
 */
export async function scheduleReminders(
  days: ReminderDay[],
  hours?: { trainHour?: number; moodHour?: number },
): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (!(await requestPermission())) return false;

  const saved = await getHours();
  const trainHour = hours?.trainHour ?? saved.trainHour;
  const moodHour = hours?.moodHour ?? saved.moodHour;

  await cancelarSoloRecordatorios();

  // recordatorios de entrenamiento: solo días pendientes, próxima ocurrencia
  for (const d of days) {
    if (d.done || d.week_day == null) continue;
    const when = nextDateFor(d.week_day, trainHour);
    if (!when) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Día ${d.day_number} · ${d.name}`,
        body: 'Te toca entrenar hoy. Abre la app para registrarlo 💪',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
      },
    });
  }

  // encuesta de energía: diaria
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '¿Cómo te sientes hoy?',
      body: 'Registra tu energía del día en un toque.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: moodHour,
      minute: 0,
    },
  });

  await AsyncStorage.setItem(ENABLED_KEY, '1');
  await setHours(trainHour, moodHour);
  return true;
}

/** Reprograma solo si el usuario ya activó los recordatorios (silencioso). */
export async function refreshReminders(days: ReminderDay[]): Promise<void> {
  if (!(await notificationsEnabled())) return;
  await scheduleReminders(days);
}

export async function cancelReminders(): Promise<void> {
  await cancelarSoloRecordatorios();
  await AsyncStorage.setItem(ENABLED_KEY, '0');
}

/**
 * Cancela los recordatorios programados SIN tocar el aviso de fin de descanso.
 *
 * OJO — acoplamiento fácil de romper: `refreshReminders` corre cada vez que se
 * abre la pantalla "Hoy". Antes esto era `cancelAllScheduledNotificationsAsync()`,
 * que borraba también el aviso del descanso que el alumno acababa de iniciar en
 * "Registrar ejercicio" — sin ningún error ni señal: el aviso simplemente no
 * llegaba nunca. Por eso cancelamos por identificador y saltamos los avisos
 * marcados con `data.kind === REST_KIND`. Si agregas otro tipo de notificación
 * que deba sobrevivir a la reprogramación, márcala igual y exclúyela acá.
 */
async function cancelarSoloRecordatorios(): Promise<void> {
  const programadas = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of programadas) {
    if ((n.content?.data as any)?.kind === REST_KIND) continue;
    await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }
}

/**
 * Programa el aviso local de fin de descanso para el instante `endsAt`.
 * Es lo único que llega si el alumno bloquea la pantalla mientras descansa:
 * con la app suspendida no corre ni el temporizador de JS ni la vibración.
 * Devuelve el identificador para poder cancelarlo puntualmente.
 */
export async function scheduleRestAlert(endsAt: number): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (endsAt - Date.now() < 1000) return null;
  // Solo CONSULTA el permiso, nunca lo pide: iOS deja pedirlo una sola vez, y
  // pedirlo acá haría aparecer el diálogo del sistema encima del teclado a
  // mitad de una serie, sin explicar nada. Un "No permitir" por reflejo mata
  // para siempre los recordatorios de entrenamiento y obliga a ir a Ajustes.
  // El pedido explícito se queda donde el alumno entiende qué acepta
  // (`scheduleReminders`, desde el perfil). Sin permiso, no hay aviso: el
  // temporizador en pantalla y el háptico funcionan igual.
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return null;
  } catch {
    return null;
  }
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Descanso terminado',
        body: 'Vuelve a la serie 💪',
        data: { kind: REST_KIND },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(endsAt),
      },
    });
  } catch {
    return null;
  }
}

/**
 * Cancela el aviso de descanso: al cancelar el descanso o al terminar con la
 * app abierta (no debe llegar un aviso de algo que ya pasó). Sin `id` —por
 * ejemplo tras recargar la app— barre por la marca `data.kind`.
 */
export async function cancelRestAlert(id?: string | null): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      return;
    }
    const programadas = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of programadas) {
      if ((n.content?.data as any)?.kind === REST_KIND) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch {
    // sin permisos o sin módulo nativo: no hay nada que cancelar
  }
}

/**
 * Registra el token push de Expo de este dispositivo para el usuario.
 * Se llama al iniciar sesión. Idempotente (upsert).
 */
export async function registerPushToken(userId: string): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  if (!(await requestPermission())) return;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId;
  if (!projectId) return;

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from('push_tokens').upsert(
      { user_id: userId, token, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,token' },
    );
  } catch {
    // sin conexión o permiso: se reintenta el próximo login
  }
}

/** Elimina el token de este dispositivo (al cerrar sesión). */
export async function unregisterPushToken(userId: string): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;
    if (!projectId) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from('push_tokens').delete().eq('user_id', userId).eq('token', token);
  } catch {}
}
