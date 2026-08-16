// Lógica pura de progreso: sin React, sin Supabase — testeable de forma aislada.

export interface LogLite {
  series_id: string;
  week_number: number;
  weight: number;
  reps: number;
}

export type Tone = 'up' | 'flat' | 'down';

/** Fuerza estimada (1RM Epley): captura mejoras de peso Y de reps en un número. */
export function score(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

/** 1RM estimado, redondeado a 1 decimal. reps=1 devuelve el peso tal cual. */
export function oneRepMax(weight: number, reps: number): number | null {
  if (!weight || !reps || reps < 1) return null;
  if (reps === 1) return weight;
  return Math.round(score(weight, reps) * 10) / 10;
}

/**
 * La mejor serie de un ejercicio, por fuerza estimada.
 *
 * Mira TODOS los registros a propósito — incluidas la semana en curso y las
 * semanas incompletas. splitClosedWeeks descarta esas semanas para los
 * gráficos y los % de mejora (ahí una semana a medias sí distorsiona la
 * comparación), pero aplicarlo también acá escondía récords reales: a un
 * alumno que hizo 77.1x12 en una semana donde solo registró 4 de sus 5 días
 * se le seguía mostrando 68x10 de un mes antes como "mejor marca".
 *
 * Ante empate gana la más antigua: es la fecha en que se consiguió la marca.
 */
export function bestSet(logs: LogLite[]): { weight: number; reps: number; week: number } | null {
  if (logs.length === 0) return null;
  const ordenados = logs.slice().sort((a, b) => a.week_number - b.week_number);
  const mejor = ordenados.reduce((best, cur) =>
    score(cur.weight, cur.reps) > score(best.weight, best.reps) ? cur : best);
  return { weight: mejor.weight, reps: mejor.reps, week: mejor.week_number };
}

/**
 * Semanas cerradas: excluye la semana calendario en curso y, si la última
 * semana con datos no cubre todos los días del plan, también la excluye
 * (una semana a medias distorsiona los gráficos y las comparaciones).
 */
export function splitClosedWeeks(
  logs: LogLite[],
  currentWeek: number,
  seriesToDay: Record<string, string>,
  totalPlanDays: number,
): { closedLogs: LogLite[]; partialWeek: number | null } {
  const valid = logs.filter(l => l.week_number < currentWeek);
  if (valid.length === 0) {
    return { closedLogs: [], partialWeek: logs.length > 0 ? currentWeek : null };
  }

  const daysInWeek: Record<number, Set<string>> = {};
  valid.forEach(l => {
    const day = seriesToDay[l.series_id];
    if (day) (daysInWeek[l.week_number] ??= new Set()).add(day);
  });

  const lastWeek = Math.max(...valid.map(l => l.week_number));
  const isPartial = (daysInWeek[lastWeek]?.size ?? 0) < totalPlanDays;

  return {
    closedLogs: isPartial ? valid.filter(l => l.week_number !== lastWeek) : valid,
    partialWeek: isPartial ? lastWeek : (logs.length > valid.length ? currentWeek : null),
  };
}

/** Clasifica un delta % en mejorando / manteniendo / por mejorar (umbral ±1%). */
export function toneOf(delta: number | null): Tone | null {
  if (delta == null) return null;
  if (delta > 1) return 'up';
  if (delta < -1) return 'down';
  return 'flat';
}

/** Delta % entre la última semana y la anterior, según fuerza estimada. */
export function weeklyDelta(points: { week: number; score: number }[]): number | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1].score;
  const prev = points[points.length - 2].score;
  if (prev === 0) return null;
  return ((last - prev) / prev) * 100;
}

/** Tope del rango de reps objetivo ("8-12" → 12, "10" → 10). */
export function repTopOf(repsObjective?: string | null): number | null {
  if (!repsObjective) return null;
  const range = repsObjective.match(/(\d+)\s*-\s*(\d+)/);
  if (range) return parseInt(range[2], 10);
  const single = parseInt(repsObjective, 10);
  return isNaN(single) ? null : single;
}

/**
 * Autoprogresión: solo si TODAS las series de la semana previa alcanzaron el
 * tope del rango. Devuelve el peso sugerido por serie (+2.5%, al medio kilo).
 */
export function suggestProgression(
  prevSets: { weight: number; reps: number }[] | null,
  repsObjective?: string | null,
): number[] | null {
  const top = repTopOf(repsObjective);
  if (!top || !prevSets || prevSets.length === 0) return null;
  if (!prevSets.every(s => s.reps >= top)) return null;
  return prevSets.map(s => Math.round(s.weight * 1.025 * 2) / 2);
}

/** Discos por lado para alcanzar un peso objetivo con una barra dada. */
export function platesPerSide(
  target: number,
  barWeight: number,
  available: number[] = [25, 20, 15, 10, 5, 2.5, 1.25],
): { plates: number[]; remainder: number } | null {
  if (!target || target <= barWeight) return null;
  let perSide = (target - barWeight) / 2;
  const plates: number[] = [];
  for (const p of available) {
    while (perSide >= p - 0.001) {
      plates.push(p);
      perSide -= p;
    }
  }
  return { plates, remainder: Math.round(perSide * 2 * 100) / 100 };
}

/**
 * Cruce energía × rendimiento: volumen medio de los días con energía baja
 * (≤ lowMax) frente a los de energía alta (≥ highMin).
 */
export function energyPerformance(
  sessions: { date: string; volume: number }[],
  moods: { logged_date: string; energy: number }[],
  lowMax = 4,
  highMin = 7,
): { low: number; high: number; deltaPct: number; lowDays: number; highDays: number } | null {
  const energyByDate: Record<string, number> = {};
  moods.forEach(m => { energyByDate[m.logged_date] = m.energy; });

  const lows: number[] = [];
  const highs: number[] = [];
  sessions.forEach(s => {
    const e = energyByDate[s.date.slice(0, 10)];
    if (e == null) return;
    if (e <= lowMax) lows.push(s.volume);
    else if (e >= highMin) highs.push(s.volume);
  });

  if (lows.length === 0 || highs.length === 0) return null;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const low = Math.round(avg(lows));
  const high = Math.round(avg(highs));
  return {
    low,
    high,
    deltaPct: low === 0 ? 0 : Math.round(((high - low) / low) * 100),
    lowDays: lows.length,
    highDays: highs.length,
  };
}

export interface TopSetLog {
  series_id: string;
  weight: number;
  reps: number;
}

/**
 * La mejor serie registrada de cada ejercicio, para mostrarla en "Hoy" en los
 * ejercicios ya completados.
 *
 * Usa el mismo `score` que `bestSet`: si dos pantallas de la app usaran
 * criterios distintos para "la mejor serie", volveríamos a tener un alumno
 * viendo dos números diferentes para lo mismo.
 */
export function topSetByExercise(
  logs: TopSetLog[],
  seriesToExercise: Record<string, string>,
): Record<string, { weight: number; reps: number }> {
  const mejores: Record<string, { weight: number; reps: number }> = {};
  logs.forEach(l => {
    const exId = seriesToExercise[l.series_id];
    if (!exId) return; // registro de una serie que ya no está en el plan
    const actual = mejores[exId];
    if (!actual || score(l.weight, l.reps) > score(actual.weight, actual.reps)) {
      mejores[exId] = { weight: l.weight, reps: l.reps };
    }
  });
  return mejores;
}

export interface ExerciseRecord {
  name: string;
  unit: string;
  best: { weight: number; reps: number; week: number };
}

/**
 * El récord más reciente del alumno, para encabezar la pantalla de progreso.
 *
 * No se elige "la marca más pesada": comparar 1RM entre ejercicios distintos
 * siempre daría sentadilla o peso muerto, y la pantalla mostraría el mismo
 * número para siempre. El récord más reciente, en cambio, se mueve cuando el
 * alumno progresa — que es lo que da ganas de mirarlo.
 *
 * Ante empate de semana gana la mayor fuerza estimada, con el mismo `score`
 * que usan `bestSet` y `topSetByExercise`.
 */
export function latestRecord(records: ExerciseRecord[]): ExerciseRecord | null {
  const conDatos = records.filter(r => r.best.week > 0);
  if (conDatos.length === 0) return null;
  return conDatos.reduce((mejor, cur) => {
    if (cur.best.week !== mejor.best.week) return cur.best.week > mejor.best.week ? cur : mejor;
    return score(cur.best.weight, cur.best.reps) > score(mejor.best.weight, mejor.best.reps)
      ? cur
      : mejor;
  });
}
