import { MUSCLE_GROUPS, SLUG_POR_GRUPO } from '../muscles';

describe('grupos musculares', () => {
  it('todos los grupos del producto se dibujan en el muñeco', () => {
    // sin esto, un grupo nuevo (o renombrado) se dibujaría en blanco sin avisar
    const sinDibujo = MUSCLE_GROUPS.filter(g => !SLUG_POR_GRUPO[g]);
    expect(sinDibujo).toEqual([]);
  });

  it('no sobra ninguna traducción sin grupo que la use', () => {
    const huerfanas = Object.keys(SLUG_POR_GRUPO).filter(
      k => !(MUSCLE_GROUPS as readonly string[]).includes(k),
    );
    expect(huerfanas).toEqual([]);
  });

  it('las tres cabezas de hombro comparten zona', () => {
    expect(SLUG_POR_GRUPO['Hombro anterior']).toBe('deltoids');
    expect(SLUG_POR_GRUPO['Hombro medial']).toBe('deltoids');
    expect(SLUG_POR_GRUPO['Hombro posterior']).toBe('deltoids');
  });

  it('los tres glúteos comparten zona', () => {
    expect(SLUG_POR_GRUPO['Glúteo mayor']).toBe('gluteal');
    expect(SLUG_POR_GRUPO['Glúteo medio']).toBe('gluteal');
    expect(SLUG_POR_GRUPO['Glúteo menor']).toBe('gluteal');
  });

  it('no hay grupos repetidos en la lista', () => {
    expect(new Set(MUSCLE_GROUPS).size).toBe(MUSCLE_GROUPS.length);
  });
});
