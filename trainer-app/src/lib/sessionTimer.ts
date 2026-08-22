// Lógica de tiempo del cronómetro de sesión ("comenzar entrenamiento").
//
// La misma regla que restTimer.ts: se guarda el INSTANTE DE INICIO, nunca los
// segundos corridos. iOS suspende los setInterval de JS con la app en segundo
// plano —y bloquear la pantalla es lo normal mientras se entrena—, así que el
// reloj se calcula SIEMPRE contra `startedAt` y la hora actual: al volver de
// segundo plano el valor es correcto, nunca el conteo congelado donde quedó.

/** Una sesión que dura más que esto quedó abandonada, no entrenada. */
export const SESION_COLGADA_HORAS = 6;

export function elapsedSeconds(startedAtIso: string, now: Date = new Date()): number {
  const ms = now.getTime() - new Date(startedAtIso).getTime();
  return Math.max(0, Math.floor(ms / 1000));
}

/**
 * "47:12" mientras corre; con horas, "1:07:33". El formato de un cronómetro,
 * no una frase: se mira de reojo entre series.
 */
export function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const dos = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${dos(m)}:${dos(s)}` : `${m}:${dos(s)}`;
}

/** "54 min" o "1 h 12 min": la duración GUARDADA, para leerse como frase. */
export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/**
 * Una sesión abierta hace más de SESION_COLGADA_HORAS no se retoma con el
 * reloj corriendo: se le ofrece al alumno descartarla. Contar 9 horas porque
 * ayer olvidó apretar "terminar" convertiría el dato en basura — y el dato
 * es el punto de la feature.
 */
export function esSesionColgada(startedAtIso: string, now: Date = new Date()): boolean {
  return elapsedSeconds(startedAtIso, now) > SESION_COLGADA_HORAS * 3600;
}
