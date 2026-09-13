// Aritmética de semanas SEGURA ANTE EL CAMBIO DE HORA, para el navegador.
//
// El bug que la motivó: weekNumberForDate/weekStartDate restan fechas
// construidas en hora LOCAL. En Vercel (UTC, sin cambios de hora) eso es
// exacto; pero en un navegador en Chile, el paso a horario de verano
// (-04 → -03, septiembre) deja los lunes exactos con una hora menos de
// diferencia contra la época — y el floor los tira a la semana ANTERIOR.
// Síntoma real: el selector marcaba la semana del 14 y el texto decía
// "comienza el lun 7", y el servidor recibía la semana equivocada.
//
// Acá todo se calcula con Date.UTC sobre (año, mes, día): días de
// calendario puros, sin zona, idéntico a lo que computan Vercel y las
// edge functions (que corren en UTC). Misma época: lunes 15-06-2026.

const EPOCH_UTC = Date.UTC(2026, 5, 15);
const SEMANA_MS = 7 * 86400000;

/** Nº de semana del programa para una fecha local (solo Y-M-D cuentan). */
export function semanaDeFecha(d: Date): number {
  const ms = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH_UTC;
  return Math.max(1, Math.floor(ms / SEMANA_MS) + 1);
}

/** El lunes en que empieza una semana, como fecha local (00:00). */
export function lunesDeSemana(n: number): Date {
  const utc = new Date(EPOCH_UTC + (n - 1) * SEMANA_MS);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

/** Semana actual con la fecha de HOY en Chile (clave de día de Santiago). */
export function semanaActualChile(instante: Date = new Date()): number {
  const clave = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(instante);
  const [y, m, d] = clave.split('-').map(Number);
  return Math.max(1, Math.floor((Date.UTC(y, m - 1, d) - EPOCH_UTC) / SEMANA_MS) + 1);
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "lun 14 sep" — para decir cuándo comienza el programa. */
export function etiquetaLunes(n: number): string {
  const d = lunesDeSemana(n);
  return `lun ${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`;
}

/** El domingo con que termina una semana (lunes + 6), fecha local. */
export function domingoDeSemana(n: number): Date {
  const d = lunesDeSemana(n);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 6);
}

/** "dom 20 sep" — para decir cuándo termina el programa. */
export function etiquetaDomingo(n: number): string {
  const d = domingoDeSemana(n);
  return `dom ${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`;
}
