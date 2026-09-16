import { describe, it, expect } from 'vitest';
import { aEditSet, aResuelta, pesoANumero, resumenSets } from '../setsEditor';
import { resolverSerie } from '../objetivoSerie';

const base = aEditSet(resolverSerie({ reps_objective: '12-15', target_rir: '2', ref_weight: 17.5 }, {}), 'a');

describe('setsEditor', () => {
  it('ida y vuelta EditSet ↔ SerieResuelta', () => {
    expect(base.peso).toBe('17.5');
    expect(aResuelta(base).ref_weight).toBe(17.5);
  });
  it('peso con coma, vacío o inválido', () => {
    expect(pesoANumero('17,5')).toBe(17.5);
    expect(pesoANumero('  ')).toBeNull();
    expect(pesoANumero('abc')).toBeNull();
    expect(pesoANumero('-3')).toBeNull();
  });
  it('resumen: sets iguales se comprimen', () => {
    expect(resumenSets([base, { ...base, id: 'b' }], ['rir'], 'reps', 'kg')).toBe('2 × 12-15 reps · RIR 2');
  });
  it('resumen: el tipo de set no rompe la igualdad; reps distintas se listan', () => {
    expect(resumenSets([base, { ...base, id: 'b', set_type: 'fallo' }], ['rir'], 'reps', 'kg')).toBe('2 × 12-15 reps · RIR 2');
    expect(resumenSets([base, { ...base, id: 'b', reps: '8' }], ['rir'], 'reps', 'kg')).toBe('2 sets · 12-15/8');
  });
});
