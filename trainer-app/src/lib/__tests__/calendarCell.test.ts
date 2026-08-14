import { estadoDeCelda, EstadoDeCeldaArgs } from '../calendarCell';

// Argumentos base reutilizables: un día planificado "lunes" con 2 ejercicios,
// nada registrado, nada fuera de lo planificado.
function base(overrides: Partial<EstadoDeCeldaArgs> = {}): EstadoDeCeldaArgs {
  return {
    planificadosHoy: [{ id: 'd1', exerciseIds: ['e1', 'e2'] }],
    fueraDeLoPlanificado: [],
    hechosPorDia: new Map(),
    claveDeEstaCelda: '2026-07-06',
    clavesDeLaSemana: ['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10', '2026-07-11', '2026-07-12'],
    esPasado: false,
    huboErrorDeConsulta: false,
    ...overrides,
  };
}

describe('estadoDeCelda', () => {
  it('vacio: nada planificado ni entrenado', () => {
    expect(estadoDeCelda(base({ planificadosHoy: [] }))).toBe('vacio');
  });

  it('fuera: nada planificado hoy pero se entrenó otra sesión de la semana este día', () => {
    expect(estadoDeCelda(base({
      planificadosHoy: [],
      fueraDeLoPlanificado: [{ id: 'd2', exerciseIds: ['e3'] }],
    }))).toBe('fuera');
  });

  it('vacio: día planificado sin ejercicios activos (todos archivados) no es "perdido"', () => {
    expect(estadoDeCelda(base({
      planificadosHoy: [{ id: 'd1', exerciseIds: [] }],
      esPasado: true,
    }))).toBe('vacio');
  });

  it('completo: todos los ejercicios del día registrados hoy', () => {
    const hechosPorDia = new Map([['2026-07-06', new Set(['e1', 'e2'])]]);
    expect(estadoDeCelda(base({ hechosPorDia }))).toBe('completo');
  });

  it('parcial: algunos ejercicios registrados hoy', () => {
    const hechosPorDia = new Map([['2026-07-06', new Set(['e1'])]]);
    expect(estadoDeCelda(base({ hechosPorDia }))).toBe('parcial');
  });

  it('movido: nada hoy, pero se registró otro día de la misma semana', () => {
    const hechosPorDia = new Map([['2026-07-08', new Set(['e1', 'e2'])]]);
    expect(estadoDeCelda(base({ hechosPorDia }))).toBe('movido');
  });

  it('perdido: día pasado, sin registro en toda la semana', () => {
    expect(estadoDeCelda(base({ esPasado: true }))).toBe('perdido');
  });

  it('HOY nunca es perdido: esPasado=false aunque no haya registro', () => {
    expect(estadoDeCelda(base({ esPasado: false }))).toBe('pendiente');
  });

  it('pendiente: día futuro sin registrar', () => {
    expect(estadoDeCelda(base({ esPasado: false }))).toBe('pendiente');
  });

  it('si la consulta de registros falló, NO se marca perdido aunque sea pasado', () => {
    expect(estadoDeCelda(base({ esPasado: true, huboErrorDeConsulta: true }))).toBe('pendiente');
  });

  it('si la consulta falló, tampoco se pierde un "movido" real', () => {
    const hechosPorDia = new Map([['2026-07-08', new Set(['e1', 'e2'])]]);
    expect(estadoDeCelda(base({ hechosPorDia, esPasado: true, huboErrorDeConsulta: true }))).toBe('movido');
  });
});
