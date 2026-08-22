// La cola de eventos de uso, pura y probada aparte del transporte.
//
// Reglas que protegen a la app de su propia telemetría:
//   - la cola tiene TOPE: si nadie logra vaciarla (sin red por días), se
//     descartan los eventos MÁS VIEJOS — perder datos de uso es aceptable,
//     crecer sin límite en el teléfono del alumno no.
//   - se envía por LOTES: nunca un insert por toque.

export interface EventoUso {
  name: string;
  props: Record<string, unknown>;
  /** cuándo ocurrió en el teléfono (ISO): los lotes llegan tarde a propósito */
  occurred_at: string;
}

/** Más que esto acumulado = algo está roto; los viejos dejan de importar. */
export const TOPE_COLA = 500;
/** Tamaño del lote por envío. */
export const TAMANO_LOTE = 25;

export function encolar(cola: EventoUso[], evento: EventoUso, tope = TOPE_COLA): EventoUso[] {
  const nueva = [...cola, evento];
  return nueva.length > tope ? nueva.slice(nueva.length - tope) : nueva;
}

/** El próximo lote a enviar y lo que queda esperando. */
export function tomarLote(
  cola: EventoUso[], tamano = TAMANO_LOTE,
): { lote: EventoUso[]; resto: EventoUso[] } {
  return { lote: cola.slice(0, tamano), resto: cola.slice(tamano) };
}
