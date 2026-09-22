import { describe, it, expect } from 'vitest';
import { resolverSerie, aplanarSeries, lineaSerie, leerDescanso, formatoDescanso } from '../objetivoSerie';

// MISMOS casos que el espejo de la otra superficie (web ↔ trainer-app)
const ej = { reps_objective: '12-15', rest_seconds: 90, target_rir: '2', ref_weight: 20, tempo: null };

describe('resolverSerie', () => {
  it('un set vacío hereda todo del ejercicio', () => {
    expect(resolverSerie(ej, {})).toEqual({
      reps: '12-15', rest_seconds: 90, tempo: '', rir: '2', rpe: '', pct_1rm: '', pct_fcmax: '', ref_weight: 20, set_type: 'efectiva',
    });
  });
  it('lo propio del set gana; blancos cuentan como vacío', () => {
    const r = resolverSerie(ej, { reps_objective: '8', target_rir: '  ', ref_weight: 0, set_type: 'drop' });
    expect(r.reps).toBe('8');
    expect(r.rir).toBe('2');
    expect(r.ref_weight).toBe(0);
    expect(r.set_type).toBe('drop');
  });
  it('tipo de set desconocido = efectiva', () => {
    expect(resolverSerie(ej, { set_type: 'superset' }).set_type).toBe('efectiva');
  });
});

describe('aplanarSeries', () => {
  it('el ejercicio lleva el set 1 y los sets solo lo distinto', () => {
    const s1 = resolverSerie(ej, {});
    const s3 = { ...s1, reps: '8', ref_weight: 25, set_type: 'fallo' as const };
    const { ejercicio, series } = aplanarSeries([s1, s1, s3]);
    expect(ejercicio).toEqual({
      reps_objective: '12-15', rest_seconds: 90, tempo: null, target_rir: '2', target_rpe: null, target_pct_1rm: null, target_pct_fcmax: null, ref_weight: 20,
    });
    expect(series[0]).toEqual({
      reps_objective: null, rest_seconds: null, tempo: null, target_rir: null, target_rpe: null, target_pct_1rm: null, target_pct_fcmax: null, ref_weight: null, set_type: null,
    });
    expect(series[2]).toEqual({
      reps_objective: '8', rest_seconds: null, tempo: null, target_rir: null, target_rpe: null, target_pct_1rm: null, target_pct_fcmax: null, ref_weight: 25, set_type: 'fallo',
    });
  });
  it('un vacío en un set posterior NO hereda el valor del set 1 (bug de ida y vuelta)', () => {
    const s1 = { ...resolverSerie(ej, {}), pct_1rm: '80/85', rest_seconds: 90 };
    const s2 = { ...resolverSerie(ej, {}), pct_1rm: '', rest_seconds: null, ref_weight: null };
    const { ejercicio, series } = aplanarSeries([s1, s2]);
    expect(series.map((s) => resolverSerie(ejercicio, s))).toEqual([s1, s2]);
  });
  it('ida y vuelta: resolver lo aplanado devuelve lo mismo', () => {
    const sets = [
      resolverSerie(ej, {}),
      { ...resolverSerie(ej, {}), pct_1rm: '80/85', rest_seconds: 120 },
    ];
    const { ejercicio, series } = aplanarSeries(sets);
    expect(series.map((s) => resolverSerie(ejercicio, s))).toEqual(sets);
  });
});

describe('lineaSerie', () => {
  const s = { reps: '12-15', rest_seconds: 90, tempo: '', rir: '2', rpe: '', pct_1rm: '80/85%', pct_fcmax: '75', ref_weight: 60, set_type: 'efectiva' as const };
  it('volumen + escalas en el orden elegido', () => {
    expect(lineaSerie(s, ['rir', 'pct_1rm'], 'reps', 'kg')).toBe('12-15 reps · RIR 2 · 80/85%');
    expect(lineaSerie(s, ['kg'], 'reps', 'lb')).toBe('12-15 reps · 60 lb');
    expect(lineaSerie(s, ['pct_fcmax'], 'reps', 'kg')).toBe('12-15 reps · 75% FCmax');
  });
  it('tiempo, tipo de set y tempo', () => {
    expect(lineaSerie({ ...s, reps: '45', set_type: 'calentamiento', tempo: '3-1-1-0' }, ['rpe'], 'tiempo', 'kg'))
      .toBe('Calentamiento · 45 s · Tempo 3-1-1-0');
  });
});

describe('descanso en un campo', () => {
  it('lee como escribe un coach', () => {
    expect(leerDescanso('90')).toBe(90);
    expect(leerDescanso('2')).toBe(120);
    expect(leerDescanso('10')).toBe(600);
    expect(leerDescanso('11')).toBe(11);
    expect(leerDescanso('1:30')).toBe(90);
    expect(leerDescanso('01:30')).toBe(90);
    expect(leerDescanso('1.30')).toBe(90);
    expect(leerDescanso('1,5')).toBe(90);
    expect(leerDescanso('45s')).toBe(45);
    expect(leerDescanso('3m')).toBe(180);
    expect(leerDescanso(' 2 min ')).toBe(120);
  });
  it('vacío es null; basura no toca el valor', () => {
    expect(leerDescanso('')).toBeNull();
    expect(leerDescanso('abc')).toBeUndefined();
    expect(leerDescanso('1:75')).toBeUndefined();
  });
  it('formato y tope', () => {
    expect(formatoDescanso(90)).toBe('01:30');
    expect(formatoDescanso(0)).toBe('00:00');
    expect(formatoDescanso(null)).toBe('');
    expect(leerDescanso('9999')).toBe(3600);
  });
});
