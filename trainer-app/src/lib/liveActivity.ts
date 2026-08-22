// El reloj vivo de la pantalla bloqueada (iOS Live Activities, ActivityKit).
//
// El tick NO lo hace la app: `elapsedTimer.startDate` le entrega el instante
// de inicio al widget nativo y iOS dibuja el cronómetro corriendo él mismo —
// la app puede estar suspendida o muerta y el reloj sigue. Es el mismo
// principio de restTimer/sessionTimer (guardar el instante, no los segundos),
// llevado al sistema operativo.
//
// Todo es best-effort: sin iOS 16.2+, en Android, o si ActivityKit falla, la
// sesión funciona igual — el dato vive en workout_sessions, no acá.

import { Platform } from 'react-native';
import * as LiveActivity from 'expo-live-activity';
import { formatDuration } from './sessionTimer';

// El monocromo de la marca, en el formato sin '#' que pide la librería.
const COLORES = {
  backgroundColor: '00030D',
  titleColor: 'D8D9D7',
  subtitleColor: '949DA6',
  progressViewTint: 'D8D9D7',
  progressViewLabelColor: 'D8D9D7',
};

/** Arranca el cronómetro en la pantalla bloqueada. Devuelve el id, o null. */
export function startSessionActivity(dayName: string, startedAtIso: string): string | null {
  if (Platform.OS !== 'ios') return null;
  try {
    const id = LiveActivity.startActivity(
      {
        title: 'Entrenamiento en curso',
        subtitle: dayName,
        progressBar: {
          elapsedTimer: { startDate: new Date(startedAtIso).getTime() },
        },
      },
      { timerType: 'digital', ...COLORES },
    );
    return id ?? null; // null: iOS < 16.2 — el aviso fijo sigue cubriendo
  } catch {
    return null;
  }
}

/** Cierra el cronómetro dejando el resumen como estado final. */
export function stopSessionActivity(id: string | null, durationSeconds: number | null): void {
  if (!id || Platform.OS !== 'ios') return;
  try {
    LiveActivity.stopActivity(id, {
      title: durationSeconds != null
        ? `Entrenaste ${formatDuration(durationSeconds)}`
        : 'Entrenamiento descartado',
      subtitle: durationSeconds != null ? 'Bien hecho 💪' : '',
    });
  } catch {
    // cerrar el widget jamás puede romper el guardado de la sesión
  }
}
