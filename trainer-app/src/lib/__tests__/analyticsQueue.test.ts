import { encolar, tomarLote, TOPE_COLA, EventoUso } from '../analyticsQueue';

const ev = (n: number): EventoUso =>
  ({ name: `e${n}`, props: {}, occurred_at: new Date(n * 1000).toISOString() });

describe('encolar', () => {
  it('agrega al final', () => {
    const cola = encolar(encolar([], ev(1)), ev(2));
    expect(cola.map(e => e.name)).toEqual(['e1', 'e2']);
  });

  it('con la cola llena descarta los MAS VIEJOS, nunca crece sin limite', () => {
    let cola: EventoUso[] = [];
    for (let i = 0; i < TOPE_COLA + 30; i++) cola = encolar(cola, ev(i));
    expect(cola.length).toBe(TOPE_COLA);
    expect(cola[0].name).toBe('e30');                  // los primeros 30 cayeron
    expect(cola[cola.length - 1].name).toBe(`e${TOPE_COLA + 29}`);
  });
});

describe('tomarLote', () => {
  it('separa el lote del resto sin perder nada', () => {
    let cola: EventoUso[] = [];
    for (let i = 0; i < 40; i++) cola = encolar(cola, ev(i));
    const { lote, resto } = tomarLote(cola);
    expect(lote.length).toBe(25);
    expect(resto.length).toBe(15);
    expect(lote[0].name).toBe('e0');    // FIFO: lo mas viejo sale primero
    expect(resto[0].name).toBe('e25');
  });

  it('con menos que un lote, va todo', () => {
    const { lote, resto } = tomarLote([ev(1), ev(2)]);
    expect(lote.length).toBe(2);
    expect(resto).toEqual([]);
  });
});
