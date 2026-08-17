// Encadenar ejercicios en biseries y triseries, para el editor del coach.
//
// Regla de oro: ninguna función de acá reordena la lista. `groupBySuperseries`
// (en plan.ts) solo agrupa ejercicios CONSECUTIVOS, y por eso encadenar es
// siempre "unir con el de arriba": la adyacencia queda garantizada sin tocar
// `order_index`, que es lo que determina qué entrena el alumno y en qué orden.

export interface Chainable {
  id: string;
  superseries_group: string | null;
}

/** Las letras que se asignan solas, en orden. */
const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

/**
 * Colores de autoría, solo para el editor del coach.
 *
 * No viven en el tema a propósito: la app es monocroma y estos colores no son
 * parte de su sistema visual. Son una ayuda para escanear agrupaciones
 * mientras se arma el plan. El alumno ve las mismas superseries en gris.
 */
const COLORES = ['#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#22c55e', '#ef4444'];

/**
 * La próxima letra libre del día.
 *
 * Las etiquetas viejas escritas a mano ("Superserie 1") no ocupan letra: son
 * de planes anteriores a este cambio y conviven sin estorbar.
 */
export function nextGroupLabel(existing: (string | null)[]): string {
  const usadas = new Set(existing.filter((e): e is string => !!e));
  // primero A..Z; si esas 26 ya están todas ocupadas, sigue con A2..Z2, A3..Z3, etc.
  // así nunca se devuelve una etiqueta repetida, aunque el caso sea improbable.
  for (let ronda = 1; ; ronda++) {
    for (const letra of LETRAS) {
      const candidata = ronda === 1 ? letra : `${letra}${ronda}`;
      if (!usadas.has(candidata)) return candidata;
    }
  }
}

/**
 * Limpia etiquetas que no forman un grupo real: con menos de dos ejercicios,
 * o con ejercicios no consecutivos (algo que `groupBySuperseries` tampoco
 * agruparía). Un grupo de uno no es un grupo, y por eso esta regla vive en un
 * solo lugar y la usan `chainWith`, `unchain` y `dissolveGroup`.
 *
 * Se exporta como `normalizeGroups` para poder aplicarla también al **cargar**
 * un plan: una escritura que quedó a medias, o una etiqueta huérfana de planes
 * viejos, dibujaría una píldora de grupo sobre un ejercicio suelto. Normalizar
 * lo que se muestra es correcto; reescribir los datos del coach al cargar, no.
 */
export function normalizeGroups<T extends Chainable>(exercises: T[]): T[] {
  const conteo = new Map<string, number>();
  for (const e of exercises) {
    if (e.superseries_group) {
      conteo.set(e.superseries_group, (conteo.get(e.superseries_group) ?? 0) + 1);
    }
  }

  // una etiqueta es inválida si reaparece después de un hueco (no consecutiva)
  const noConsecutivas = new Set<string>();
  const vistas = new Set<string>();
  let anterior: string | null = null;
  for (const e of exercises) {
    const g = e.superseries_group;
    if (g) {
      if (g !== anterior && vistas.has(g)) noConsecutivas.add(g);
      vistas.add(g);
    }
    anterior = g;
  }

  return exercises.map(e => {
    const g = e.superseries_group;
    if (!g) return e;
    const invalida = (conteo.get(g) ?? 0) < 2 || noConsecutivas.has(g);
    return invalida ? { ...e, superseries_group: null } : e;
  });
}

/** Une el ejercicio con el de arriba. Si el de arriba ya tiene grupo, se suma a él. */
export function chainWith<T extends Chainable>(exercises: T[], exerciseId: string): T[] {
  const i = exercises.findIndex(e => e.id === exerciseId);
  if (i <= 0) return exercises; // el primero no tiene con quién encadenarse
  const anterior = exercises[i - 1];
  const label = anterior.superseries_group
    ?? nextGroupLabel(exercises.map(e => e.superseries_group));
  const resultado = exercises.map((e, idx) =>
    idx === i || idx === i - 1 ? { ...e, superseries_group: label } : e,
  );
  // si el de arriba ya tenía grupo y era el único puente entre dos tramos,
  // encadenarlo con otro puede dejar huérfano al resto de su grupo viejo
  return normalizeGroups(resultado);
}

/** Saca un ejercicio de su grupo; si el grupo queda de uno, lo disuelve. */
export function unchain<T extends Chainable>(exercises: T[], exerciseId: string): T[] {
  const objetivo = exercises.find(e => e.id === exerciseId);
  const label = objetivo?.superseries_group;
  if (!label) return exercises;
  const sinEl = exercises.map(e =>
    e.id === exerciseId ? { ...e, superseries_group: null } : e,
  );
  return normalizeGroups(sinEl);
}

/** Deshace un grupo completo. */
export function dissolveGroup<T extends Chainable>(exercises: T[], label: string): T[] {
  const resultado = exercises.map(e =>
    e.superseries_group === label ? { ...e, superseries_group: null } : e,
  );
  return normalizeGroups(resultado);
}

/** Cómo se llama un grupo según cuántos ejercicios tenga. */
export function groupNameFor(count: number, label: string): string {
  if (count === 2) return `BISERIE ${label}`;
  if (count === 3) return `TRISERIE ${label}`;
  return `SUPERSERIE ${label}`;
}

/** El color de un grupo. Estable para la misma etiqueta. */
export function colorForLabel(label: string): string {
  let suma = 0;
  for (let i = 0; i < label.length; i++) suma += label.charCodeAt(i);
  return COLORES[suma % COLORES.length];
}
