import { puedeCancelar, HORAS_LIMITE_CANCELACION, formatCita } from '../citas';
import { PARQ_PREGUNTAS, parqCompleto } from '../parq';

const T = (horas: number) => new Date(Date.now() + horas * 3600 * 1000).toISOString();

describe('puedeCancelar (espejo de la política de la v31)', () => {
  it('con 3 horas de anticipación, sí', () => {
    expect(puedeCancelar(T(3))).toBe(true);
  });
  it('con 1 hora, no — la base también diría que no', () => {
    expect(puedeCancelar(T(1))).toBe(false);
  });
  it('justo en el límite, no (la base usa <=)', () => {
    expect(puedeCancelar(T(HORAS_LIMITE_CANCELACION))).toBe(false);
  });
});

describe('formatCita', () => {
  it('día, número y hora con minutos en dos dígitos', () => {
    // 2026-08-25 es martes; 18:05 local
    const d = new Date(2026, 7, 25, 18, 5);
    expect(formatCita(d.toISOString())).toBe('martes 25 · 18:05');
  });
});

describe('PAR-Q', () => {
  it('son 7 preguntas con ids únicos', () => {
    expect(PARQ_PREGUNTAS.length).toBe(7);
    expect(new Set(PARQ_PREGUNTAS.map(p => p.id)).size).toBe(7);
  });
  it('completo exige las 7 respondidas', () => {
    const todas = Object.fromEntries(PARQ_PREGUNTAS.map(p => [p.id, false]));
    expect(parqCompleto(todas)).toBe(true);
    expect(parqCompleto({ ...todas, p7: undefined })).toBe(false);
    expect(parqCompleto({})).toBe(false);
  });
});
