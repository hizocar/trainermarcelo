import { DURATION, DELAY, RING_BEZIER, rowDelay } from '../motion';

describe('rowDelay', () => {
  it('la primera fila entra después del retardo base', () => {
    expect(rowDelay(0)).toBe(DELAY.rowBase);
  });

  it('cada fila siguiente se escalona un paso', () => {
    expect(rowDelay(1)).toBe(DELAY.rowBase + DELAY.rowStep);
    expect(rowDelay(2)).toBe(DELAY.rowBase + DELAY.rowStep * 2);
  });

  it('la cascada se corta a partir de la fila 8: una sesión larga no debe tardar segundos en aparecer', () => {
    // 8 filas ya son ~940ms de cascada; más allá se entra sin retardo extra
    expect(rowDelay(8)).toBe(rowDelay(7));
    expect(rowDelay(20)).toBe(rowDelay(7));
  });

  it('un índice negativo no rompe: se trata como la primera fila', () => {
    expect(rowDelay(-1)).toBe(DELAY.rowBase);
  });
});

describe('duraciones', () => {
  it('el anillo dura más que una fila: es el gesto principal', () => {
    expect(DURATION.ring).toBeGreaterThan(DURATION.row);
  });

  it('el número del centro empieza después de que arranca el anillo', () => {
    expect(DELAY.value).toBeGreaterThan(0);
    expect(DELAY.value).toBeLessThan(DURATION.ring);
  });

  it('el anillo dura los ~1.1s del diseño', () => {
    expect(DURATION.ring).toBe(1100);
  });
});

describe('curva del anillo', () => {
  it('es exactamente la cubic-bezier(.22, 1, .36, 1) que especifica el diseño', () => {
    expect([...RING_BEZIER]).toEqual([0.22, 1, 0.36, 1]);
  });
});
