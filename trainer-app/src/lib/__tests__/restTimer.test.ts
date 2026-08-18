import { secondsLeft, restOptions, formatRest, REST_PRESETS } from '../restTimer';

describe('secondsLeft', () => {
  const now = 1_700_000_000_000;

  it('devuelve los segundos que faltan', () => {
    expect(secondsLeft(now + 90_000, now)).toBe(90);
  });

  it('el descanso ya terminado da 0', () => {
    expect(secondsLeft(now, now)).toBe(0);
  });

  it('nunca devuelve negativos', () => {
    expect(secondsLeft(now - 1_000, now)).toBe(0);
    expect(secondsLeft(now - 5_500, now)).toBe(0);
  });

  // Ojo: esto prueba solo el clamp para un endsAt muy viejo, la misma rama que
  // los dos casos de arriba. El regreso desde segundo plano en sí (AppState, el
  // intervalo y el ciclo de programar/cancelar el aviso) NO tiene cobertura.
  it('un endsAt del pasado lejano (6 h) da 0, no un negativo enorme', () => {
    expect(secondsLeft(now - 6 * 60 * 60 * 1000, now)).toBe(0);
  });

  it('redondea hacia arriba: aún queda 1s mientras no llegue a cero', () => {
    expect(secondsLeft(now + 1, now)).toBe(1);
    expect(secondsLeft(now + 1_500, now)).toBe(2);
  });
});

describe('restOptions', () => {
  it('sin indicación del coach ofrece 1, 2 y 3 minutos', () => {
    expect(restOptions(undefined).map(o => o.seconds)).toEqual([60, 120, 180]);
    expect(restOptions(undefined).some(o => o.sugerida)).toBe(false);
    expect(restOptions(null).map(o => o.seconds)).toEqual([...REST_PRESETS]);
  });

  it('si el coach usa un preset, ese queda marcado como sugerido', () => {
    const opciones = restOptions(120);
    expect(opciones.map(o => o.seconds)).toEqual([60, 120, 180]);
    expect(opciones.filter(o => o.sugerida).map(o => o.seconds)).toEqual([120]);
  });

  it('un rest_seconds distinto se agrega como opción sugerida, en orden', () => {
    const opciones = restOptions(90);
    expect(opciones.map(o => o.seconds)).toEqual([60, 90, 120, 180]);
    expect(opciones.filter(o => o.sugerida).map(o => o.seconds)).toEqual([90]);
  });

  it('ignora valores inválidos', () => {
    expect(restOptions(0).map(o => o.seconds)).toEqual([60, 120, 180]);
    expect(restOptions(-30).map(o => o.seconds)).toEqual([60, 120, 180]);
  });
});

describe('formatRest', () => {
  it('formatea mm:ss', () => {
    expect(formatRest(90)).toBe('1:30');
    expect(formatRest(60)).toBe('1:00');
    expect(formatRest(5)).toBe('0:05');
    expect(formatRest(0)).toBe('0:00');
  });

  it('no imprime negativos', () => {
    expect(formatRest(-9)).toBe('0:00');
  });
});
