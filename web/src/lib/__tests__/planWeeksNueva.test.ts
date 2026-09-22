import { describe, it, expect } from 'vitest';
import { numeroNuevaSemana, resolveActiveWeek, type PlanWeek } from '../planWeeks';

// MISMOS casos que trainer-app/src/lib/__tests__/planNuevaSemana.test.ts
const semana = (n: number, extra: Partial<PlanWeek> = {}): PlanWeek => ({
  id: `w${n}`, plan_id: 'p', week_number: n, name: `Semana ${n}`,
  is_deload: false, repeat_forever: false, archived: false, ...extra,
});

describe('numeroNuevaSemana', () => {
  it('el caso real: plan viejo con la semana 1 → la nueva es la de HOY, no la 2', () => {
    const weeks = [semana(1, { repeat_forever: true })];
    expect(numeroNuevaSemana(weeks, 15)).toBe(15);
    // y esa semana sí la ve el alumno hoy
    const nueva = semana(numeroNuevaSemana(weeks, 15));
    expect(resolveActiveWeek([...weeks, nueva], 15)).toBe(nueva);
  });

  it('plan al día: la nueva es la SIGUIENTE, no la de hoy otra vez', () => {
    const weeks = [semana(13), semana(14), semana(15)];
    expect(numeroNuevaSemana(weeks, 15)).toBe(16);
  });

  it('nunca pisa una semana existente ni nace en el pasado', () => {
    expect(numeroNuevaSemana([semana(20)], 15)).toBe(21);
    expect(numeroNuevaSemana([], 15)).toBe(15);
  });

  it('las archivadas no cuentan para el máximo', () => {
    expect(numeroNuevaSemana([semana(30, { archived: true }), semana(15)], 15)).toBe(16);
  });
});
