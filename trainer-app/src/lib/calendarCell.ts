// Estado visual de una celda del calendario mensual del alumno (Tarea 9).
// Reproduce EXACTO el que usa la web (web/src/app/clients/[id]/calendar/page.tsx),
// que salió de una revisión que encontró cinco defectos distintos acá — no
// tocar esta lógica sin volver a esa revisión.

export type EstadoCelda =
  | 'vacio'          // no hay nada planificado ni entrenado ese día
  | 'completo'       // planificado ese día y todos sus ejercicios registrados
  | 'parcial'        // planificado ese día y algunos registrados
  | 'pendiente'      // planificado hoy o en el futuro, sin registrar
  | 'movido'         // planificado ese día, pero se entrenó otro día de la semana
  | 'fuera'          // se entrenó ese día, pero estaba planificado otro
  | 'perdido';       // planificado, ya pasó, y no se registró en toda la semana

export interface DiaPlanificado {
  id: string;
  exerciseIds: string[];
}

export interface EstadoDeCeldaArgs {
  /** días planificados que caen en esta fecha */
  planificadosHoy: DiaPlanificado[];
  /** días planificados de la semana que se entrenaron EN esta fecha aunque tocaban otra */
  fueraDeLoPlanificado: DiaPlanificado[];
  /** exercise_id registrado, por clave de día "YYYY-MM-DD" */
  hechosPorDia: Map<string, Set<string>>;
  claveDeEstaCelda: string;
  clavesDeLaSemana: string[];
  /** estrictamente anterior a hoy; HOY nunca es pasado */
  esPasado: boolean;
  huboErrorDeConsulta: boolean;
}

export function estadoDeCelda(args: EstadoDeCeldaArgs): EstadoCelda {
  const {
    planificadosHoy, fueraDeLoPlanificado, hechosPorDia,
    claveDeEstaCelda, clavesDeLaSemana, esPasado, huboErrorDeConsulta,
  } = args;

  if (planificadosHoy.length === 0) {
    return fueraDeLoPlanificado.length > 0 ? 'fuera' : 'vacio';
  }

  const dia = planificadosHoy[0];
  const total = dia.exerciseIds.length;
  // Un día sin ejercicios activos no puede estar "perdido": no hay nada que perder.
  if (total === 0) return 'vacio';

  const hechosHoy = hechosPorDia.get(claveDeEstaCelda) ?? new Set<string>();
  const hechos = dia.exerciseIds.filter(id => hechosHoy.has(id)).length;

  if (hechos >= total) return 'completo';
  if (hechos > 0) return 'parcial';

  // ¿se entrenó esta sesión otro día de la misma semana?
  const seMovio = clavesDeLaSemana.some(k => {
    if (k === claveDeEstaCelda) return false;
    const hechosEseDia = hechosPorDia.get(k);
    return !!hechosEseDia && dia.exerciseIds.some(id => hechosEseDia.has(id));
  });
  if (seMovio) return 'movido';

  // Si la consulta de registros falló, NO acusar de perdido: no sabemos nada.
  if (esPasado && !huboErrorDeConsulta) return 'perdido';
  return 'pendiente';
}
