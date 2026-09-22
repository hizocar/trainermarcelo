import { numeroNuevaSemana, type SemanaNumerada } from '../semanasPlan';

// MISMOS casos que web/src/lib/__tests__/planWeeksNueva.test.ts (allá, donde
// resolveActiveWeek es importable, se verifica además que la semana nueva SÍ
// se ve hoy; acá resolveActiveWeek vive en plan.ts, que importa supabase).
const semana = (n: number, extra: Partial<SemanaNumerada> = {}): SemanaNumerada => ({
  week_number: n, archived: false, ...extra,
});

describe('numeroNuevaSemana', () => {
  it('el caso real: plan viejo con la semana 1 → la nueva es la de HOY, no la 2', () => {
    const weeks = [semana(1)];
    expect(numeroNuevaSemana(weeks, 15)).toBe(15);
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
