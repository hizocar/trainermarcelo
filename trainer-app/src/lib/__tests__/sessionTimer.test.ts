import {
  elapsedSeconds, formatClock, formatDuration, esSesionColgada, SESION_COLGADA_HORAS,
} from '../sessionTimer';

const T0 = '2026-08-22T10:00:00.000Z';
const en = (seg: number) => new Date(new Date(T0).getTime() + seg * 1000);

describe('elapsedSeconds', () => {
  it('cuenta contra el instante de inicio, no contra un contador', () => {
    expect(elapsedSeconds(T0, en(0))).toBe(0);
    expect(elapsedSeconds(T0, en(75))).toBe(75);
    // "volver de segundo plano" es solo mirar el reloj más tarde
    expect(elapsedSeconds(T0, en(3600 * 2))).toBe(7200);
  });

  it('un reloj del teléfono corrido hacia atrás no produce negativos', () => {
    expect(elapsedSeconds(T0, en(-30))).toBe(0);
  });
});

describe('formatClock', () => {
  it('minutos y segundos mientras corre', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(59)).toBe('0:59');
    expect(formatClock(60)).toBe('1:00');
    expect(formatClock(47 * 60 + 12)).toBe('47:12');
  });

  it('con horas, las muestra', () => {
    expect(formatClock(3600)).toBe('1:00:00');
    expect(formatClock(3600 + 7 * 60 + 33)).toBe('1:07:33');
  });
});

describe('formatDuration', () => {
  it('la duración guardada se lee como frase', () => {
    expect(formatDuration(54 * 60)).toBe('54 min');
    expect(formatDuration(3600)).toBe('1 h');
    expect(formatDuration(3600 + 12 * 60)).toBe('1 h 12 min');
  });

  it('los segundos sueltos redondean al minuto', () => {
    expect(formatDuration(54 * 60 + 40)).toBe('55 min');
  });
});

describe('esSesionColgada', () => {
  it('dentro del límite se retoma', () => {
    expect(esSesionColgada(T0, en(3600 * SESION_COLGADA_HORAS - 1))).toBe(false);
  });

  it('pasado el límite ya no es un entrenamiento, es un olvido', () => {
    expect(esSesionColgada(T0, en(3600 * SESION_COLGADA_HORAS + 1))).toBe(true);
  });
});
