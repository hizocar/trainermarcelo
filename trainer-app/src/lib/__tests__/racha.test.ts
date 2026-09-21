import { calcularRacha, textoEstado, textoCompartir, diasEntre } from '../racha';

// La regla: sobrevive a 1 o 2 días sin entrenar; se pierde con 3 o más.
describe('calcularRacha', () => {
  it('sin registros no hay racha', () => {
    expect(calcularRacha([], '2026-09-20')).toEqual({
      actual: 0, mejor: 0, ultimoDia: null, diasDesdeUltimo: null, estado: 'sin-datos',
    });
  });

  it('días seguidos cuentan uno a uno', () => {
    const r = calcularRacha(['2026-09-18', '2026-09-19', '2026-09-20'], '2026-09-20');
    expect(r.actual).toBe(3);
    expect(r.mejor).toBe(3);
    expect(r.estado).toBe('viva');
    expect(r.diasDesdeUltimo).toBe(0);
  });

  it('descansar 1 o 2 días NO corta la racha', () => {
    // entrena lun 14, descansa ma-mi, entrena jue 17, descansa vie, entrena sáb 19
    const r = calcularRacha(['2026-09-14', '2026-09-17', '2026-09-19'], '2026-09-19');
    expect(r.actual).toBe(3);
    expect(r.estado).toBe('viva');
  });

  it('3 días sin entrenar la corta: la cadena vuelve a empezar', () => {
    // 14 → 18 son 3 días sin entrenar (15, 16, 17)
    const r = calcularRacha(['2026-09-12', '2026-09-14', '2026-09-18', '2026-09-19'], '2026-09-19');
    expect(r.actual).toBe(2); // 18 y 19
    expect(r.mejor).toBe(2);
  });

  it('el récord sobrevive aunque la racha actual se corte', () => {
    const r = calcularRacha(
      ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-15'],
      '2026-09-15',
    );
    expect(r.actual).toBe(1);
    expect(r.mejor).toBe(4);
  });

  it('en riesgo el tercer día; perdida al cuarto', () => {
    const dias = ['2026-09-15', '2026-09-16'];
    expect(calcularRacha(dias, '2026-09-18').estado).toBe('viva');      // 2 días después
    const riesgo = calcularRacha(dias, '2026-09-19');                    // 3 días después
    expect(riesgo.estado).toBe('en-riesgo');
    expect(riesgo.actual).toBe(2);                                       // entrenar hoy la mantiene
    const perdida = calcularRacha(dias, '2026-09-20');                   // 4 días después
    expect(perdida.estado).toBe('perdida');
    expect(perdida.actual).toBe(0);
    expect(perdida.mejor).toBe(2);
  });

  it('desordenados, repetidos y futuros no ensucian la cuenta', () => {
    const r = calcularRacha(
      ['2026-09-19', '2026-09-18', '2026-09-19', '2026-09-25'],
      '2026-09-19',
    );
    expect(r.actual).toBe(2);
    expect(r.ultimoDia).toBe('2026-09-19');
  });

  it('el cambio de hora no descuadra los días', () => {
    // en Chile el 6-sep-2026 el día dura 23 horas
    expect(diasEntre('2026-09-05', '2026-09-06')).toBe(1);
    expect(calcularRacha(['2026-09-05', '2026-09-06'], '2026-09-06').actual).toBe(2);
  });
});

describe('textos', () => {
  it('cada estado habla distinto', () => {
    expect(textoEstado(calcularRacha([], '2026-09-20'))).toMatch(/empieza tu racha/);
    expect(textoEstado(calcularRacha(['2026-09-20'], '2026-09-20'))).toMatch(/Entrenaste hoy/);
    expect(textoEstado(calcularRacha(['2026-09-19'], '2026-09-20'))).toMatch(/2 días para mantenerla/);
    expect(textoEstado(calcularRacha(['2026-09-17'], '2026-09-20'))).toMatch(/Último día/);
    expect(textoEstado(calcularRacha(['2026-09-01', '2026-09-02'], '2026-09-20'))).toMatch(/récord es 2 días/);
  });

  it('lo que se comparte lleva el nombre, los días y la app', () => {
    const r = calcularRacha(['2026-09-18', '2026-09-19', '2026-09-20'], '2026-09-20');
    const t = textoCompartir(r, 'Camila Rojas');
    expect(t).toContain('Camila:');
    expect(t).toContain('3 días de racha');
    expect(t).toContain('récord');
    expect(t).toContain('apps.apple.com/app/id6788209434');
    expect(textoCompartir(calcularRacha(['2026-09-20'], '2026-09-20'))).toContain('1 día de racha');
  });
});
