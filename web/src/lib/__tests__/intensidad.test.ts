import { describe, it, expect } from 'vitest';
import { lineaIntensidad } from '../intensidad';

// MISMOS casos que trainer-app/src/lib/__tests__/intensidad.test.ts
describe('lineaIntensidad', () => {
  it('vacía si el coach no llenó nada', () => {
    expect(lineaIntensidad({})).toBe('');
    expect(lineaIntensidad({ target_rir: '  ', target_rpe: null, tempo: '' })).toBe('');
  });
  it('todos los campos en orden fijo', () => {
    expect(lineaIntensidad({ tempo: '3-1-1-0', target_pct_1rm: '75-80', target_rpe: '8', target_rir: '2' }))
      .toBe('RIR 2 · RPE 8 · 75-80% 1RM · Tempo 3-1-1-0');
  });
  it('solo lo que hay', () => {
    expect(lineaIntensidad({ target_rpe: '8-9' })).toBe('RPE 8-9');
    expect(lineaIntensidad({ target_rir: '2', tempo: '2-0-1-0' })).toBe('RIR 2 · Tempo 2-0-1-0');
  });
  it('no duplica el % si el coach lo escribió', () => {
    expect(lineaIntensidad({ target_pct_1rm: '70%' })).toBe('70% 1RM');
    expect(lineaIntensidad({ target_pct_1rm: ' 70 % ' })).toBe('70% 1RM');
  });
});
