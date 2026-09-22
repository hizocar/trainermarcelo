import { resolverSerie, aplanarSeries, lineaSerie, leerDescanso, formatoDescanso, pasoNumero, etiquetaEscala, OPCIONES_RIR, OPCIONES_RPE } from '../objetivoSerie';

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

describe('pasoNumero (flechas ↑ ↓ de la tabla)', () => {
  it('sube y baja números simples', () => {
    expect(pasoNumero('120', 2.5)).toBe('122.5');
    expect(pasoNumero('122.5', -2.5)).toBe('120');
    expect(pasoNumero('2', 1)).toBe('3');
    expect(pasoNumero('17,5', 2.5)).toBe('20');
  });
  it('mueve el rango entero', () => {
    expect(pasoNumero('8-10', 1)).toBe('9-11');
    expect(pasoNumero('8-10', -1)).toBe('7-9');
  });
  it('desde vacío arranca del valor inicial', () => {
    expect(pasoNumero('', 2.5, 20)).toBe('22.5');
    expect(pasoNumero('', 1)).toBe('1');
  });
  it('nunca baja de 0', () => {
    expect(pasoNumero('1', -5)).toBe('0');
  });
  it('lo que no es número se deja como está', () => {
    expect(pasoNumero('80/85', 5)).toBeNull();
    expect(pasoNumero('al fallo', 1)).toBeNull();
  });
});

describe('etiquetaEscala (listas fijas de RIR y RPE)', () => {
  it('antepone la escala solo si el valor empieza con número', () => {
    expect(etiquetaEscala('rir', '2 - 80/85%')).toBe('RIR 2 - 80/85%');
    expect(etiquetaEscala('rir', 'SUAVE 50%')).toBe('SUAVE 50%');
    expect(etiquetaEscala('rpe', '7-8 INTENSO')).toBe('RPE 7-8 INTENSO');
    expect(etiquetaEscala('rir', '')).toBe('');
  });
  it('la línea del alumno usa esas etiquetas', () => {
    const base = { reps: '8', rest_seconds: null, tempo: '', rir: '2 - 80/85%', rpe: '', pct_1rm: '', pct_fcmax: '', ref_weight: null, set_type: 'efectiva' as const };
    expect(lineaSerie(base, ['rir'], 'reps', 'kg')).toBe('8 reps · RIR 2 - 80/85%');
    expect(lineaSerie({ ...base, rir: 'SUAVE 50%' }, ['rir'], 'reps', 'kg')).toBe('8 reps · SUAVE 50%');
  });
  it('las listas son las que definió el equipo', () => {
    expect(OPCIONES_RIR).toHaveLength(5);
    expect(OPCIONES_RIR[2]).toBe('2 - 80/85%');
    expect(OPCIONES_RPE[0]).toBe('1 MUY SUAVE');
    expect(OPCIONES_RPE).toContain('10 MAX');
  });
});
