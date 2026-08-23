// La ficha de ingreso: el PAR-Q estándar (Physical Activity Readiness
// Questionnaire), 7 preguntas de sí/no. Cualquier "sí" no bloquea nada — la
// ficha informa al coach, no diagnostica.

export interface PreguntaParq { id: string; texto: string }

export const PARQ_PREGUNTAS: PreguntaParq[] = [
  { id: 'p1', texto: '¿Un médico te ha dicho que tienes un problema cardíaco y que solo deberías hacer actividad física recomendada por él?' },
  { id: 'p2', texto: '¿Sientes dolor en el pecho cuando haces actividad física?' },
  { id: 'p3', texto: 'En el último mes, ¿has tenido dolor en el pecho estando en reposo?' },
  { id: 'p4', texto: '¿Pierdes el equilibrio por mareos, o has perdido el conocimiento?' },
  { id: 'p5', texto: '¿Tienes algún problema en huesos o articulaciones que pueda empeorar con la actividad física?' },
  { id: 'p6', texto: '¿Tomas medicamentos recetados para la presión arterial o el corazón?' },
  { id: 'p7', texto: '¿Conoces alguna otra razón por la que no deberías hacer actividad física?' },
];

/** La ficha está completa cuando las 7 tienen respuesta. */
export function parqCompleto(answers: Record<string, unknown>): boolean {
  return PARQ_PREGUNTAS.every(p => typeof answers[p.id] === 'boolean');
}
