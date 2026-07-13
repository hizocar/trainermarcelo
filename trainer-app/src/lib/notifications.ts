import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

// Recordatorios locales (no requieren servidor).
//
// Se reprograman cada vez que se abre la app o se guarda un entrenamiento:
// así nunca avisan de un día que ya está completado. Por eso usamos avisos
// puntuales para los próximos 7 días en vez de repeticiones semanales fijas.

const ENABLED_KEY = 'notif_enabled_v1';
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

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
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

  await Notifications.cancelAllScheduledNotificationsAsync();

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
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.setItem(ENABLED_KEY, '0');
}
