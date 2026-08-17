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
const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

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
  return LETRAS.find(l => !usadas.has(l)) ?? LETRAS[0];
}

/** Une el ejercicio con el de arriba. Si el de arriba ya tiene grupo, se suma a él. */
export function chainWith<T extends Chainable>(exercises: T[], exerciseId: string): T[] {
  const i = exercises.findIndex(e => e.id === exerciseId);
  if (i <= 0) return exercises; // el primero no tiene con quién encadenarse
  const anterior = exercises[i - 1];
  const label = anterior.superseries_group
    ?? nextGroupLabel(exercises.map(e => e.superseries_group));
  return exercises.map((e, idx) =>
    idx === i || idx === i - 1 ? { ...e, superseries_group: label } : e,
  );
}

/** Saca un ejercicio de su grupo; si el grupo queda de uno, lo disuelve. */
export function unchain<T extends Chainable>(exercises: T[], exerciseId: string): T[] {
  const objetivo = exercises.find(e => e.id === exerciseId);
  const label = objetivo?.superseries_group;
  if (!label) return exercises;
  const sinEl = exercises.map(e =>
    e.id === exerciseId ? { ...e, superseries_group: null } : e,
  );
  const quedan = sinEl.filter(e => e.superseries_group === label).length;
  return quedan >= 2 ? sinEl : dissolveGroup(sinEl, label);
}

/** Deshace un grupo completo. */
export function dissolveGroup<T extends Chainable>(exercises: T[], label: string): T[] {
  return exercises.map(e =>
    e.superseries_group === label ? { ...e, superseries_group: null } : e,
  );
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
