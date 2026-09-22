// Numeración de las semanas de un plan. Módulo PURO y aparte a propósito:
// plan.ts importa supabase y jest no puede cargarlo (AsyncStorage null).

export interface SemanaNumerada {
  week_number: number;
  archived: boolean;
}

/**
 * El número que debe llevar una semana NUEVA (crear o duplicar).
 *
 * week_number es la semana CALENDARIO (se cuenta desde la época del
 * entrenamiento), no un correlativo del plan. Numerar "la siguiente de la
 * lista" (max + 1) en un plan cuya única semana es la 1 crea la semana 2 —
 * que ocurrió hace meses — y la app, que pide la semana de hoy, nunca la
 * muestra: el coach edita algo que su alumno jamás ve. Pasó de verdad
 * (Carolina Flores: "Semana 1 (copia)" con 5 ejercicios, invisible).
 *
 * Por eso una semana nueva nunca nace en el pasado: o es la de hoy, o la
 * siguiente libre.
 */
export function numeroNuevaSemana(weeks: SemanaNumerada[], semanaActual: number): number {
  const maximo = weeks.filter(w => !w.archived).reduce((m, w) => Math.max(m, w.week_number), 0);
  return Math.max(maximo + 1, semanaActual);
}
