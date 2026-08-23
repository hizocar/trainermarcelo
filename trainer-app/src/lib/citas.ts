// Lógica pura de la agenda del alumno.
//
// La política de cancelación REAL vive en la base (cancelar_cita, v31): esto
// es solo el espejo para la interfaz — ocultar el botón cuando la base igual
// va a decir que no. Si divergieran, la base gana y la app muestra su error.

/** Hasta cuántas horas antes puede cancelar el alumno. Espejo de la v31. */
export const HORAS_LIMITE_CANCELACION = 2;

export function puedeCancelar(startsAtIso: string, now: Date = new Date()): boolean {
  const limite = new Date(startsAtIso).getTime() - HORAS_LIMITE_CANCELACION * 3600 * 1000;
  return now.getTime() < limite;
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** "martes 26 · 18:30" — cómo se nombra una cita en la app. */
export function formatCita(startsAtIso: string): string {
  const d = new Date(startsAtIso);
  const hora = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${DIAS[d.getDay()]} ${d.getDate()} · ${hora}`;
}
