// Ritmo del movimiento de la app, en un solo lugar.
//
// Todo aparece con desaceleración (rápido al empezar, suave al terminar):
// es lo que hace que una interfaz se sienta viva en vez de mecánica. No hay
// animaciones en bucle a propósito — esta pantalla se abre varias veces por
// sesión de entrenamiento y algo que late sin parar termina molestando.

export const DURATION = {
  /** el anillo llenándose: el gesto principal de la pantalla */
  ring: 1100,
  /** el número del centro apareciendo */
  value: 800,
  /** una fila de ejercicio subiendo */
  row: 500,
} as const;

export const DELAY = {
  /** el número entra con el anillo ya en movimiento, no antes */
  value: 150,
  /** la primera fila espera a que el anillo tenga avance visible */
  rowBase: 300,
  /** separación entre filas consecutivas */
  rowStep: 80,
} as const;

/**
 * Configuración de `withSpring` que produce la desaceleración del diseño.
 * Se usa un resorte y no una curva fija porque interrumpe bien: si el alumno
 * cambia de día a media animación, el resorte reacciona desde donde está en
 * vez de saltar.
 */
export const EASING_OUT = { damping: 18, stiffness: 90, mass: 1 } as const;

/** Máximo de filas que participan de la cascada. */
const MAX_STAGGERED_ROWS = 8;

/**
 * Cuándo entra la fila número `index`. A partir de la octava deja de
 * escalonarse: un día con doce ejercicios tardaría más de un segundo en
 * terminar de dibujarse, y para entonces la animación estorba en vez de
 * ayudar.
 */
export function rowDelay(index: number): number {
  const i = Math.min(Math.max(index, 0), MAX_STAGGERED_ROWS - 1);
  return DELAY.rowBase + DELAY.rowStep * i;
}
