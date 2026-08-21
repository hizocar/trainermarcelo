// Cuándo el coach tiene que confirmar antes de pisar lo que el alumno ya
// registró. Vive acá y no en la pantalla porque la pantalla de registro son
// 849 líneas y esta es la única regla nueva que trae la función del coach.
//
// El índice único workout_logs (series_id, week_number) permite un solo
// registro por serie y semana: escribir encima no crea otro, reemplaza.

export type SerieRegistrada = {
  seriesNumber: number;
  weight: number;
  reps: number;
};

/**
 * `esPropio` — el que teclea es el dueño del entrenamiento.
 * `yaRegistrada` — la serie tenía un valor al abrir la pantalla.
 * `desbloqueada` — ya se confirmó el reemplazo de esta serie en esta visita.
 */
export function necesitaConfirmar(args: {
  esPropio: boolean;
  yaRegistrada: boolean;
  desbloqueada: boolean;
}): boolean {
  if (args.esPropio) return false;
  return args.yaRegistrada && !args.desbloqueada;
}

/** Muestra el valor que se va a perder: confirmar a ciegas no es confirmar. */
export function textoConfirmacion(s: SerieRegistrada): string {
  if (s.weight === 0) {
    return `La serie ${s.seriesNumber} ya tiene ${s.reps} repeticiones. ¿Reemplazar?`;
  }
  const peso = String(s.weight).replace('.', ',');
  return `La serie ${s.seriesNumber} ya tiene ${peso} kg × ${s.reps}. ¿Reemplazar?`;
}
