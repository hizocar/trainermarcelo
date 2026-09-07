import { planVencido } from '../planVencido';

// La fecha límite del plan (v36): el día del límite todavía se entrena;
// vencido es desde el día siguiente. Sin fecha, nunca vence.
describe('planVencido', () => {
  const el15 = new Date(2026, 8, 15); // 15-09-2026 local

  it('sin fecha límite nunca vence', () => {
    expect(planVencido(null, el15)).toBe(false);
    expect(planVencido(undefined, el15)).toBe(false);
  });

  it('antes del límite no está vencido', () => {
    expect(planVencido('2026-09-20', el15)).toBe(false);
  });

  it('el mismo día del límite todavía se entrena', () => {
    expect(planVencido('2026-09-15', el15)).toBe(false);
  });

  it('desde el día siguiente está vencido', () => {
    expect(planVencido('2026-09-14', el15)).toBe(true);
    expect(planVencido('2025-01-01', el15)).toBe(true);
  });

  it('meses y días de un dígito comparan bien (relleno con cero)', () => {
    expect(planVencido('2026-09-05', new Date(2026, 8, 5))).toBe(false);
    expect(planVencido('2026-09-05', new Date(2026, 8, 6))).toBe(true);
  });
});
