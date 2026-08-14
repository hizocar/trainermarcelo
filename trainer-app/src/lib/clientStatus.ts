// ¿Este alumno necesita que el coach haga algo?
//
// La regla se ajusta al plan de CADA alumno en vez de usar un número fijo de
// días: quien entrena dos veces por semana no debe aparecer como alerta por
// no entrenar un martes.
//
// Espejo exacto de web/src/lib/clientStatus.ts — los valores deben coincidir
// para las mismas entradas.

export interface ClientStatusInput {
  /** ¿tiene un plan con una semana activa? */
  hasPlan: boolean;
  /** días de la semana planificados (0=Dom … 6=Sáb) */
  plannedWeekDays: number[];
  /** días planificados cuya sesión ya se registró en cualquier día de la semana */
  completedWeekDays: number[];
  /** hoy (0=Dom … 6=Sáb) */
  todayWeekDay: number;
}

export interface ClientStatus {
  needsAttention: boolean;
  done: number;
  total: number;
}

/**
 * Posición en el orden LUNES→DOMINGO (0..6).
 *
 * `week_day` viene con la numeración de JavaScript (domingo = 0), pero la
 * semana del programa empieza el lunes. Sin esta conversión, un domingo
 * planificado se daría por "pasado" cada lunes por la mañana.
 */
const posEnSemana = (weekDay: number): number => (weekDay + 6) % 7;

export function clientStatus(input: ClientStatusInput): ClientStatus {
  const { hasPlan, plannedWeekDays, completedWeekDays, todayWeekDay } = input;

  if (!hasPlan) return { needsAttention: false, done: 0, total: 0 };

  const planificados = Array.from(new Set(plannedWeekDays));
  const cumplidos = new Set(completedWeekDays.filter((d) => planificados.includes(d)));

  const hoyPos = posEnSemana(todayWeekDay);
  // El día de hoy nunca cuenta como perdido: mientras transcurre está pendiente.
  const needsAttention = planificados.some(
    (d) => posEnSemana(d) < hoyPos && !cumplidos.has(d),
  );

  return { needsAttention, done: cumplidos.size, total: planificados.length };
}
