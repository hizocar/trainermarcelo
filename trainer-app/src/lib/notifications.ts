import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

// Recordatorios locales: no requieren servidor y funcionan siempre.
//  - día de entrenamiento: a la hora elegida, solo los días del plan
//  - encuesta de energía: en la mañana, todos los días

const ENABLED_KEY = 'notif_enabled_v1';
const HOUR_KEY = 'notif_hour_v1';

export const DEFAULT_HOUR = 18; // 18:00

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

export async function reminderHour(): Promise<number> {
  const raw = await AsyncStorage.getItem(HOUR_KEY);
  const h = raw ? parseInt(raw, 10) : NaN;
  return isNaN(h) ? DEFAULT_HOUR : h;
}

async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'web' || !Device.isDevice) return false;
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const { status: asked } = await Notifications.requestPermissionsAsync();
  return asked === 'granted';
}

/**
 * Programa los recordatorios: uno por cada día de entrenamiento del plan
 * (semanal, a la hora elegida) + la encuesta de energía cada mañana.
 */
export async function scheduleReminders(
  days: { day_number: number; name: string; week_day?: number | null }[],
  hour: number = DEFAULT_HOUR,
): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const ok = await requestPermission();
  if (!ok) return false;

  await Notifications.cancelAllScheduledNotificationsAsync();

  // recordatorio de entrenamiento por cada día programado
  for (const d of days) {
    if (d.week_day == null) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Hoy toca Día ${d.day_number} · ${d.name}`,
        body: 'Abre la app para registrar tu entrenamiento 💪',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: d.week_day + 1,   // expo: 1=domingo … 7=sábado
        hour,
        minute: 0,
      },
    });
  }

  // encuesta de energía, todas las mañanas
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '¿Cómo te sientes hoy?',
      body: 'Registra tu energía del día en un toque.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 9,
      minute: 0,
    },
  });

  await AsyncStorage.setItem(ENABLED_KEY, '1');
  await AsyncStorage.setItem(HOUR_KEY, String(hour));
  return true;
}

export async function cancelReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.setItem(ENABLED_KEY, '0');
}
