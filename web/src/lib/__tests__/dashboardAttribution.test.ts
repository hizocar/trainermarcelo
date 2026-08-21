import { describe, it, expect } from 'vitest';
import { atribuirRegistros, planIdDelLog, type DiaPlanificado } from '../dashboardAttribution';

// Mismos casos que trainer-app/src/lib/__tests__/dashboardAttribution.test.ts.
// week_day usa la convención de JavaScript: 0=Dom, 1=Lun … 6=Sáb.
const LUN = 1, MAR = 2, MIE = 3;

const SEMANA = 10;
const PLAN = 'plan-1';
const CLIENTE = 'cliente-1';

// fecha estable, sin zona horaria de por medio: los dos proyectos inyectan su
// propia función de día y acá se prueba el algoritmo, no el huso.
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

const dia = (over: Partial<DiaPlanificado> = {}): DiaPlanificado => ({
  id: 'dia-1', plan_id: PLAN, name: 'Pecho', week_day: LUN, archived: false,
  exercises: [{ archived: false, exercise_series: [{ id: 'serie-1' }] }],
  ...over,
});

const log = (over: Partial<{ serie: string; plan: string; semana: number; cuando: string | null }> = {}) => {
  const { serie = 'serie-1', plan = PLAN, semana = SEMANA, cuando = '2026-08-17T12:00:00Z' } = over;
  return {
    series_id: serie,
    week_number: semana,
    logged_at: cuando,
    exercise_series: { exercises: { training_days: { plan_id: plan } } },
  };
};

const correr = (days: DiaPlanificado[], logs: any[]) => atribuirRegistros({
  days, logs, clientByPlan: new Map([[PLAN, CLIENTE]]), currentWeek: SEMANA, dayKey,
});

describe('planIdDelLog', () => {
  it('lee el plan del embebido como objeto', () => {
    expect(planIdDelLog({ exercise_series: { exercises: { training_days: { plan_id: 'p' } } } })).toBe('p');
  });

  it('lo lee igual si PostgREST lo envuelve en arreglos', () => {
    expect(planIdDelLog({
      exercise_series: [{ exercises: [{ training_days: [{ plan_id: 'p' }] }] }],
    })).toBe('p');
  });

  it('devuelve cadena vacía si el embebido no vino', () => {
    expect(planIdDelLog({})).toBe('');
    expect(planIdDelLog({ exercise_series: null })).toBe('');
  });
});

describe('atribuirRegistros', () => {
  it('un día planificado con registro de esta semana queda cumplido', () => {
    const r = correr([dia()], [log()]);
    expect(r.plannedByPlan.get(PLAN)).toEqual([LUN]);
    expect(Array.from(r.completedByPlan.get(PLAN) ?? [])).toEqual([LUN]);
  });

  it('un día "libre" no se planifica ni se cumple', () => {
    const r = correr([dia({ name: 'Día libre' })], [log()]);
    expect(r.plannedByPlan.get(PLAN)).toBeUndefined();
    expect(r.completedByPlan.get(PLAN)).toBeUndefined();
  });

  it('un día archivado no se planifica', () => {
    const r = correr([dia({ archived: true })], [log()]);
    expect(r.plannedByPlan.get(PLAN)).toBeUndefined();
  });

  it('un ejercicio archivado no aporta sus series', () => {
    const r = correr(
      [dia({ exercises: [{ archived: true, exercise_series: [{ id: 'serie-1' }] }] })],
      [log()],
    );
    expect(r.plannedByPlan.get(PLAN)).toEqual([LUN]);
    expect(r.completedByPlan.get(PLAN)).toBeUndefined();
  });

  it('un día sin week_day no puede quedar cumplido', () => {
    const r = correr([dia({ week_day: null })], [log()]);
    expect(r.plannedByPlan.get(PLAN)).toBeUndefined();
    expect(r.completedByPlan.get(PLAN)).toBeUndefined();
  });

  // El bug de 8649ff8: "la última vez que entrenó" no debe depender de qué
  // semanas estén activas. Un registro de la semana anterior no marca el día
  // como cumplido, pero sí cuenta como que entrenó.
  it('un registro de la semana anterior no cumple el día, pero sí es "última vez"', () => {
    const r = correr([dia()], [log({ semana: SEMANA - 1, cuando: '2026-08-10T12:00:00Z' })]);
    expect(r.completedByPlan.get(PLAN)).toBeUndefined();
    expect(r.lastTrainedByClient.get(CLIENTE)).toBe('2026-08-10');
  });

  it('se queda con la fecha más reciente', () => {
    const r = correr([dia()], [
      log({ cuando: '2026-08-11T12:00:00Z' }),
      log({ cuando: '2026-08-17T12:00:00Z' }),
      log({ cuando: '2026-08-14T12:00:00Z' }),
    ]);
    expect(r.lastTrainedByClient.get(CLIENTE)).toBe('2026-08-17');
  });

  it('varios días distintos se acumulan como cumplidos', () => {
    const days = [
      dia({ id: 'd1', week_day: LUN, exercises: [{ archived: false, exercise_series: [{ id: 's1' }] }] }),
      dia({ id: 'd2', week_day: MIE, exercises: [{ archived: false, exercise_series: [{ id: 's2' }] }] }),
    ];
    const r = correr(days, [log({ serie: 's1' }), log({ serie: 's2' })]);
    expect(r.plannedByPlan.get(PLAN)).toEqual([LUN, MIE]);
    expect(Array.from(r.completedByPlan.get(PLAN) ?? []).sort()).toEqual([LUN, MIE]);
  });

  it('el mismo día registrado dos veces no se duplica', () => {
    const r = correr([dia()], [log(), log({ cuando: '2026-08-18T12:00:00Z' })]);
    expect(Array.from(r.completedByPlan.get(PLAN) ?? [])).toEqual([LUN]);
  });

  // La razón de ser de la rama: quién tecleó el registro no importa.
  it('un registro de un plan ajeno no se le atribuye a este alumno', () => {
    const r = correr([dia()], [log({ plan: 'plan-de-otro', serie: 'serie-ajena' })]);
    expect(r.lastTrainedByClient.get(CLIENTE)).toBeUndefined();
    expect(r.completedByPlan.get(PLAN)).toBeUndefined();
  });

  it('un registro sin fecha no cuenta como "última vez" pero sí cumple el día', () => {
    const r = correr([dia()], [log({ cuando: null })]);
    expect(r.lastTrainedByClient.get(CLIENTE)).toBeUndefined();
    expect(Array.from(r.completedByPlan.get(PLAN) ?? [])).toEqual([LUN]);
  });

  it('sin días ni registros no inventa nada', () => {
    const r = correr([], []);
    expect(r.plannedByPlan.size).toBe(0);
    expect(r.completedByPlan.size).toBe(0);
    expect(r.lastTrainedByClient.size).toBe(0);
  });

  it('acepta el embebido envuelto en arreglos, como en objeto', () => {
    const enArreglo = {
      series_id: 'serie-1', week_number: SEMANA, logged_at: '2026-08-17T12:00:00Z',
      exercise_series: [{ exercises: [{ training_days: [{ plan_id: PLAN }] }] }],
    };
    const r = correr([dia()], [enArreglo]);
    expect(r.lastTrainedByClient.get(CLIENTE)).toBe('2026-08-17');
    expect(Array.from(r.completedByPlan.get(PLAN) ?? [])).toEqual([LUN]);
  });

  it('un día planificado sin ningún registro queda planificado y no cumplido', () => {
    const r = correr([dia({ week_day: MAR })], []);
    expect(r.plannedByPlan.get(PLAN)).toEqual([MAR]);
    expect(r.completedByPlan.get(PLAN)).toBeUndefined();
  });
});
