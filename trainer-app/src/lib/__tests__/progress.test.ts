import {
  score, oneRepMax, splitClosedWeeks, toneOf, weeklyDelta,
  repTopOf, suggestProgression, platesPerSide, energyPerformance,
} from '../progress';

describe('score / oneRepMax', () => {
  it('premia más reps con el mismo peso', () => {
    expect(score(100, 10)).toBeGreaterThan(score(100, 8));
  });
  it('1RM con 1 rep es el propio peso', () => {
    expect(oneRepMax(100, 1)).toBe(100);
  });
  it('1RM de 80x8 ≈ 101.3 (Epley)', () => {
    expect(oneRepMax(80, 8)).toBeCloseTo(101.3, 1);
  });
  it('devuelve null con datos inválidos', () => {
    expect(oneRepMax(0, 5)).toBeNull();
    expect(oneRepMax(80, 0)).toBeNull();
  });
});

describe('splitClosedWeeks', () => {
  // plan de 2 días: series s1→día A, s2→día B
  const map = { s1: 'dayA', s2: 'dayB' };
  const log = (series_id: string, week_number: number): any =>
    ({ series_id, week_number, weight: 50, reps: 10 });

  it('excluye la semana calendario en curso', () => {
    const logs = [log('s1', 1), log('s2', 1), log('s1', 3)];
    const { closedLogs, partialWeek } = splitClosedWeeks(logs, 3, map, 2);
    expect(closedLogs.every(l => l.week_number < 3)).toBe(true);
    expect(partialWeek).toBe(3);
  });

  it('excluye la última semana si no cubre todos los días del plan', () => {
    // semana 1 completa (2 días); semana 2 solo un día → parcial
    const logs = [log('s1', 1), log('s2', 1), log('s1', 2)];
    const { closedLogs, partialWeek } = splitClosedWeeks(logs, 5, map, 2);
    expect(closedLogs.map(l => l.week_number)).toEqual([1, 1]);
    expect(partialWeek).toBe(2);
  });

  it('conserva la última semana si está completa', () => {
    const logs = [log('s1', 1), log('s2', 1), log('s1', 2), log('s2', 2)];
    const { closedLogs, partialWeek } = splitClosedWeeks(logs, 5, map, 2);
    expect(closedLogs).toHaveLength(4);
    expect(partialWeek).toBeNull();
  });

  it('sin logs no rompe', () => {
    expect(splitClosedWeeks([], 3, map, 2)).toEqual({ closedLogs: [], partialWeek: null });
  });
});

describe('toneOf / weeklyDelta', () => {
  it('clasifica con umbral de ±1%', () => {
    expect(toneOf(5)).toBe('up');
    expect(toneOf(0.5)).toBe('flat');
    expect(toneOf(-3)).toBe('down');
    expect(toneOf(null)).toBeNull();
  });
  it('delta necesita dos semanas', () => {
    expect(weeklyDelta([{ week: 1, score: 100 }])).toBeNull();
    expect(weeklyDelta([{ week: 1, score: 100 }, { week: 2, score: 110 }])).toBeCloseTo(10);
  });
});

describe('repTopOf / suggestProgression', () => {
  it('lee el tope de un rango o un número', () => {
    expect(repTopOf('8-12')).toBe(12);
    expect(repTopOf('10')).toBe(10);
    expect(repTopOf(null)).toBeNull();
  });

  it('sugiere +2.5% solo si TODAS las series llegaron al tope', () => {
    const sets = [{ weight: 80, reps: 12 }, { weight: 80, reps: 12 }];
    expect(suggestProgression(sets, '8-12')).toEqual([82, 82]);
  });

  it('no sugiere si una serie no llegó al tope', () => {
    const sets = [{ weight: 80, reps: 12 }, { weight: 80, reps: 9 }];
    expect(suggestProgression(sets, '8-12')).toBeNull();
  });

  it('no sugiere sin historial previo', () => {
    expect(suggestProgression(null, '8-12')).toBeNull();
  });
});

describe('platesPerSide', () => {
  it('100kg con barra de 20 → 25+15 por lado (mínimo de discos)', () => {
    expect(platesPerSide(100, 20)).toEqual({ plates: [25, 15], remainder: 0 });
  });
  it('los discos suman exactamente el peso objetivo', () => {
    const r = platesPerSide(142.5, 20)!;
    const total = 20 + r.plates.reduce((a, b) => a + b, 0) * 2;
    expect(total).toBeCloseTo(142.5);
  });
  it('solo la barra si el objetivo no la supera', () => {
    expect(platesPerSide(20, 20)).toBeNull();
  });
  it('reporta el resto cuando no hay discos suficientes', () => {
    const r = platesPerSide(21, 20)!;
    expect(r.plates).toEqual([]);
    expect(r.remainder).toBeCloseTo(1);
  });
});

describe('energyPerformance', () => {
  it('compara volumen con energía baja vs alta', () => {
    const sessions = [
      { date: '2026-07-06', volume: 1000 },  // energía 3 → baja
      { date: '2026-07-08', volume: 1400 },  // energía 8 → alta
      { date: '2026-07-10', volume: 1200 },  // energía 9 → alta
    ];
    const moods = [
      { logged_date: '2026-07-06', energy: 3 },
      { logged_date: '2026-07-08', energy: 8 },
      { logged_date: '2026-07-10', energy: 9 },
    ];
    const r = energyPerformance(sessions, moods)!;
    expect(r.low).toBe(1000);
    expect(r.high).toBe(1300);
    expect(r.deltaPct).toBe(30);
    expect(r.lowDays).toBe(1);
    expect(r.highDays).toBe(2);
  });

  it('devuelve null si falta uno de los dos grupos', () => {
    const sessions = [{ date: '2026-07-08', volume: 1400 }];
    const moods = [{ logged_date: '2026-07-08', energy: 8 }];
    expect(energyPerformance(sessions, moods)).toBeNull();
  });
});
