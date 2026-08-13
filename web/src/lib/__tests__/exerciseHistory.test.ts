import { describe, it, expect } from 'vitest';
import {
  continuityKey, score, oneRepMax, groupHistoryByWeek, personalRecord,
  type LogRow,
} from '../exerciseHistory';

describe('continuityKey', () => {
  it('usa library_id cuando existe', () => {
    expect(continuityKey({ library_id: 'lib-1', name: 'Press banca' })).toBe('lib-1');
  });

  it('cae al nombre normalizado cuando no hay library_id', () => {
    expect(continuityKey({ library_id: null, name: '  Press Banca  ' })).toBe('press banca');
  });

  it('dos filas del mismo ejercicio en semanas distintas comparten clave', () => {
    const semana1 = { library_id: 'lib-1', name: 'Press banca' };
    const semana2 = { library_id: 'lib-1', name: 'Press banca' };
    expect(continuityKey(semana1)).toBe(continuityKey(semana2));
  });
});

describe('score / oneRepMax', () => {
  it('más reps con el mismo peso puntúa más alto', () => {
    expect(score(100, 10)).toBeGreaterThan(score(100, 8));
  });

  it('1RM con 1 rep es el propio peso, no la fórmula', () => {
    expect(oneRepMax(100, 1)).toBe(100);
  });

  it('1RM de 80x8 ≈ 101.3 (Epley, redondeado a 1 decimal)', () => {
    expect(oneRepMax(80, 8)).toBeCloseTo(101.3, 1);
  });

  it('devuelve null con datos inválidos', () => {
    expect(oneRepMax(0, 5)).toBeNull();
    expect(oneRepMax(80, 0)).toBeNull();
  });
});

describe('groupHistoryByWeek', () => {
  // s1/s2/s3 son de una sesión ("lunes"), s4/s5/s6 de otra ("jueves") del
  // mismo ejercicio en la misma semana.
  const seriesNumber = { s1: 1, s2: 2, s3: 3, s4: 1, s5: 2, s6: 3 };
  const sessionKey = { s1: 'lunes', s2: 'lunes', s3: 'lunes', s4: 'jueves', s5: 'jueves', s6: 'jueves' };
  const log = (series_id: string, week_number: number, weight: number, reps: number, logged_at: string | null = null): LogRow =>
    ({ series_id, week_number, weight, reps, rir: null, logged_at });

  it('agrupa por semana y ordena de la más reciente a la más antigua', () => {
    const out = groupHistoryByWeek(
      [log('s1', 8, 60, 10), log('s1', 9, 65, 10)],
      seriesNumber, sessionKey,
    );
    expect(out.map((w) => w.week)).toEqual([9, 8]);
  });

  it('ordena las series dentro de cada sesión por número de serie', () => {
    const out = groupHistoryByWeek(
      [log('s3', 9, 65, 8), log('s1', 9, 60, 10), log('s2', 9, 62.5, 9)],
      seriesNumber, sessionKey,
    );
    expect(out[0].sessions[0].sets.map((s) => s.series_number)).toEqual([1, 2, 3]);
  });

  it('calcula el volumen de la semana como suma de peso × reps de todas las sesiones', () => {
    const out = groupHistoryByWeek([log('s1', 9, 60, 10), log('s2', 9, 50, 10)], seriesNumber, sessionKey);
    expect(out[0].volume).toBe(1100);
  });

  it('toma como fecha de la semana la más temprana entre todas sus sesiones', () => {
    const out = groupHistoryByWeek(
      [log('s2', 9, 60, 10, '2026-08-13T10:00:00Z'), log('s1', 9, 60, 10, '2026-08-12T10:00:00Z')],
      seriesNumber, sessionKey,
    );
    expect(out[0].date).toBe('2026-08-12T10:00:00Z');
  });

  it('ignora logs de series desconocidas', () => {
    const out = groupHistoryByWeek([log('fantasma', 9, 60, 10)], seriesNumber, sessionKey);
    expect(out).toEqual([]);
  });

  it('devuelve lista vacía sin logs', () => {
    expect(groupHistoryByWeek([], seriesNumber, sessionKey)).toEqual([]);
  });

  it('separa por sesión un ejercicio programado dos veces en la misma semana', () => {
    const out = groupHistoryByWeek(
      [
        log('s1', 9, 60, 10, '2026-08-10T10:00:00Z'), // lunes
        log('s4', 9, 65, 8, '2026-08-13T10:00:00Z'),  // jueves
      ],
      seriesNumber, sessionKey,
    );
    expect(out).toHaveLength(1);
    expect(out[0].sessions).toHaveLength(2);
    // ordenadas de la más antigua a la más reciente
    expect(out[0].sessions.map((s) => s.date)).toEqual(['2026-08-10T10:00:00Z', '2026-08-13T10:00:00Z']);
    expect(out[0].sessions[0].volume).toBe(600);
    expect(out[0].sessions[1].volume).toBe(520);
    // el volumen de la semana sigue siendo la suma de ambas sesiones
    expect(out[0].volume).toBe(1120);
  });
});

describe('personalRecord', () => {
  const seriesNumber = { s1: 1 };
  const sessionKey = { s1: 'unica' };
  const log = (week_number: number, weight: number, reps: number): LogRow =>
    ({ series_id: 's1', week_number, weight, reps, rir: null, logged_at: null });

  it('elige la serie con mejor puntaje estimado, no solo el peso más alto', () => {
    // 100x5 (score 116.7) supera a 105x2 (score 112)
    const weeks = groupHistoryByWeek([log(8, 105, 2), log(9, 100, 5)], seriesNumber, sessionKey);
    expect(personalRecord(weeks)).toEqual({ weight: 100, reps: 5, week: 9 });
  });

  it('devuelve null sin historial', () => {
    expect(personalRecord([])).toBeNull();
  });
});
