// Lógica de tiempo del temporizador de descanso.
//
// Se guarda el INSTANTE EN QUE TERMINA el descanso (timestamp), nunca los
// segundos restantes: iOS suspende los setInterval de JS cuando la app pasa a
// segundo plano, y bloquear la pantalla es exactamente lo que uno hace mientras
// descansa. Contando desde `endsAt` contra la hora actual, volver de segundo
// plano da el valor correcto (o el descanso ya terminado), nunca el conteo
// congelado donde quedó.

/** Duraciones ofrecidas siempre, en segundos: 1, 2 y 3 minutos. */
export const REST_PRESETS = [60, 120, 180] as const;

export interface RestOption {
  seconds: number;
  /** la duración que configuró el coach en `rest_seconds` */
  sugerida: boolean;
}

/**
 * Opciones de descanso a mostrar. Si el coach configuró un `rest_seconds`
 * distinto de los presets, se agrega como una opción más (marcada como
 * sugerida) para no perder su indicación.
 */
export function restOptions(coachSeconds?: number | null): RestOption[] {
  const presets: RestOption[] = REST_PRESETS.map(s => ({
    seconds: s,
    sugerida: coachSeconds === s,
  }));
  if (coachSeconds == null || coachSeconds <= 0) return presets;
  if ((REST_PRESETS as readonly number[]).includes(coachSeconds)) return presets;
  return [...presets, { seconds: coachSeconds, sugerida: true }]
    .sort((a, b) => a.seconds - b.seconds);
}

/**
 * Segundos que faltan para `endsAt` según `now`. Nunca negativo: un `endsAt`
 * en el pasado (volver de segundo plano mucho después) es 0 = ya terminó.
 */
export function secondsLeft(endsAt: number, now: number): number {
  const restantes = Math.ceil((endsAt - now) / 1000);
  return restantes > 0 ? restantes : 0;
}

/** Formato de reloj para la UI: 90 → "1:30". */
export function formatRest(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
