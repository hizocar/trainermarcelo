import { buildLogUpdate } from '../logPayload';

describe('buildLogUpdate', () => {
  const base = {
    weight: 80, reps: 10, rir: 2,
    logged_at: '2026-08-20T12:00:00.000Z',
    logged_by: 'coach-1',
  };

  it('incluye logged_by: al reemplazar, el registro pasa a ser de quien tecleó', () => {
    expect(buildLogUpdate(base)).toEqual(base);
  });

  it('conserva el rir nulo en vez de perderlo', () => {
    expect(buildLogUpdate({ ...base, rir: null }).rir).toBeNull();
  });

  it('no arrastra campos de más: series_id y week_number identifican la fila, no se actualizan', () => {
    expect(Object.keys(buildLogUpdate(base)).sort())
      .toEqual(['logged_at', 'logged_by', 'reps', 'rir', 'weight']);
  });
});
