import { nivel, aPartesDelCuerpo, ESCALA } from '../MuscleMap';

describe('nivel', () => {
  it('0 o negativo no enciende nada', () => {
    expect(nivel(0)).toBe(0);
    expect(nivel(-0.5)).toBe(0);
  });

  it('NaN no enciende nada (antes se propagaba)', () => {
    expect(nivel(NaN)).toBe(0);
  });

  it('un valor mayor que 1 no pasa del último escalón', () => {
    expect(nivel(1.5)).toBe(ESCALA.length);
    expect(nivel(2)).toBe(ESCALA.length);
  });

  it('1 llega exactamente al último escalón', () => {
    expect(nivel(1)).toBe(ESCALA.length);
  });

  it('valores intermedios caen dentro del rango 1..ESCALA.length', () => {
    const n = nivel(0.1);
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(ESCALA.length);
  });
});

describe('aPartesDelCuerpo', () => {
  it('funde las tres cabezas de hombro quedándose con el nivel más alto', () => {
    const partes = aPartesDelCuerpo({
      'Hombro anterior': 0.2,
      'Hombro medial': 1,
      'Hombro posterior': 0.5,
    });
    expect(partes).toHaveLength(1);
    expect(partes[0].slug).toBe('deltoids');
    expect(partes[0].intensity).toBe(nivel(1));
  });

  it('funde los tres glúteos quedándose con el nivel más alto', () => {
    const partes = aPartesDelCuerpo({
      'Glúteo mayor': 0.3,
      'Glúteo medio': 0.1,
      'Glúteo menor': 0.9,
    });
    expect(partes).toHaveLength(1);
    expect(partes[0].slug).toBe('gluteal');
    expect(partes[0].intensity).toBe(nivel(0.9));
  });

  it('descarta un grupo desconocido sin romperse', () => {
    const partes = aPartesDelCuerpo({ 'Grupo inventado': 1 });
    expect(partes).toEqual([]);
  });

  it('intensidad 0 o negativa no enciende nada', () => {
    const partes = aPartesDelCuerpo({ 'Pecho': 0, 'Bíceps': -1 });
    expect(partes).toEqual([]);
  });

  it('grupos distintos que no comparten zona quedan separados', () => {
    const partes = aPartesDelCuerpo({ 'Pecho': 1, 'Bíceps': 0.5 });
    const slugs = partes.map(p => p.slug).sort();
    expect(slugs).toEqual(['biceps', 'chest']);
  });
});
