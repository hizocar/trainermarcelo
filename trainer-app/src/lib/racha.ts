// RACHAS: lo que mantiene al alumno volviendo.
//
// Regla acordada con Sebastián: la racha cuenta los DÍAS ENTRENADOS
// encadenados. Sobrevive a 1 o 2 días sin entrenar (el descanso es parte del
// entrenamiento) y se pierde con 3 o más. En fechas: entre dos entrenamientos
// puede haber hasta 3 días de diferencia; 4 o más rompe la cadena.
//
// Todo se calcula con días de calendario (Date.UTC sobre Y-M-D), nunca
// restando milisegundos: el cambio de hora chileno deja días de 23 horas y
// un floor sobre ms convierte "ayer" en "hace 2 días".

/** Días de descanso permitidos sin perder la racha. */
export const DESCANSO_MAXIMO = 2;
/** Diferencia máxima entre dos entrenamientos de la misma cadena. */
const SALTO_MAXIMO = DESCANSO_MAXIMO + 1;

export type EstadoRacha = 'sin-datos' | 'viva' | 'en-riesgo' | 'perdida';

export interface Racha {
  /** días entrenados en la cadena viva; 0 si se perdió */
  actual: number;
  /** la mejor cadena de toda su historia (incluida la actual) */
  mejor: number;
  /** 'YYYY-MM-DD' del último entrenamiento, o null */
  ultimoDia: string | null;
  /** días de calendario desde el último entrenamiento (0 = hoy) */
  diasDesdeUltimo: number | null;
  estado: EstadoRacha;
}

/** Días de calendario entre dos claves 'YYYY-MM-DD' (b − a). */
export function diasEntre(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/**
 * @param dias  claves 'YYYY-MM-DD' de los días con entrenamiento (en cualquier
 *              orden y con repetidos: varias series del mismo día son un día)
 * @param hoy   clave del día de hoy en Chile
 */
export function calcularRacha(dias: string[], hoy: string): Racha {
  const unicos = Array.from(new Set(dias.filter(Boolean)))
    .filter((d) => diasEntre(d, hoy) >= 0) // un registro futuro no inventa racha
    .sort();

  if (unicos.length === 0) {
    return { actual: 0, mejor: 0, ultimoDia: null, diasDesdeUltimo: null, estado: 'sin-datos' };
  }

  let cadena = 1;
  let mejor = 1;
  for (let i = 1; i < unicos.length; i++) {
    cadena = diasEntre(unicos[i - 1], unicos[i]) <= SALTO_MAXIMO ? cadena + 1 : 1;
    if (cadena > mejor) mejor = cadena;
  }

  const ultimoDia = unicos[unicos.length - 1];
  const diasDesdeUltimo = diasEntre(ultimoDia, hoy);
  // con SALTO_MAXIMO días desde el último, entrenar HOY todavía la mantiene
  const estado: EstadoRacha =
    diasDesdeUltimo > SALTO_MAXIMO ? 'perdida'
    : diasDesdeUltimo === SALTO_MAXIMO ? 'en-riesgo'
    : 'viva';

  return {
    actual: estado === 'perdida' ? 0 : cadena,
    mejor,
    ultimoDia,
    diasDesdeUltimo,
    estado,
  };
}

/** La frase bajo el número, escrita para el alumno. */
export function textoEstado(r: Racha): string {
  if (r.estado === 'sin-datos') return 'Entrena hoy y empieza tu racha.';
  if (r.estado === 'perdida') {
    return r.mejor > 1
      ? `Se cortó tu racha. Tu récord es ${r.mejor} días — entrena hoy y vas por él.`
      : 'Entrena hoy y empieza tu racha.';
  }
  if (r.estado === 'en-riesgo') return 'Último día para mantenerla: entrena hoy.';
  if (r.diasDesdeUltimo === 0) return '¡Entrenaste hoy! Sigue así.';
  return r.diasDesdeUltimo === 1
    ? 'Descansaste ayer. Te quedan 2 días para mantenerla.'
    : 'Te queda 1 día para mantenerla.';
}

/** El texto que se comparte en redes. */
export function textoCompartir(r: Racha, nombre?: string): string {
  const quien = (nombre ?? '').trim().split(' ')[0];
  const dias = `${r.actual} ${r.actual === 1 ? 'día' : 'días'}`;
  const base = r.actual >= r.mejor && r.mejor > 1
    ? `${dias} de racha entrenando — ¡es mi récord! 🔥`
    : `${dias} de racha entrenando 🔥`;
  return `${quien ? `${quien}: ` : ''}${base}\n\nEntreno con EliteFitness: https://apps.apple.com/app/id6788209434`;
}
