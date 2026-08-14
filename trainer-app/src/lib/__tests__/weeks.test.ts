import {
  calendarWeekNumberForDate, weekDates, localDateKey, monthGrid, offScheduleDayKeys,
} from '../weeks';

describe('calendarWeekNumberForDate', () => {
  it('el epoch (2026-06-15, lunes) es la semana 1', () => {
    expect(calendarWeekNumberForDate(new Date('2026-06-15T00:00:00'))).toBe(1);
  });

  it('un día antes del epoch devuelve null, no se clampea a la semana 1', () => {
    expect(calendarWeekNumberForDate(new Date('2026-06-14T00:00:00'))).toBeNull();
  });

  it('meses de historia previos al epoch también devuelven null', () => {
    expect(calendarWeekNumberForDate(new Date('2026-01-01T00:00:00'))).toBeNull();
  });

  it('la semana 4 empieza el 2026-07-06', () => {
    expect(calendarWeekNumberForDate(new Date('2026-07-06T00:00:00'))).toBe(4);
  });
});

describe('weekDates / localDateKey', () => {
  it('las 7 fechas de la semana 1 van de lunes a domingo', () => {
    const dates = weekDates(1);
    expect(dates).toHaveLength(7);
    expect(localDateKey(dates[0])).toBe('2026-06-15');
    expect(localDateKey(dates[6])).toBe('2026-06-21');
  });
});

describe('monthGrid', () => {
  it('julio 2026 empieza en lunes 29 de junio y cierra en domingo 2 de agosto', () => {
    const grid = monthGrid(2026, 6); // julio, 0-indexado
    expect(localDateKey(grid[0][0])).toBe('2026-06-29');
    const lastRow = grid[grid.length - 1];
    expect(localDateKey(lastRow[6])).toBe('2026-08-02');
  });

  it('cada fila tiene 7 días', () => {
    const grid = monthGrid(2026, 6);
    grid.forEach(row => expect(row).toHaveLength(7));
  });
});

describe('offScheduleDayKeys', () => {
  const weekKeys = ['2026-07-06', '2026-07-07', '2026-07-08'];
  it('vacío si no hay ejercicios planificados', () => {
    expect(offScheduleDayKeys([], weekKeys, '2026-07-06', new Map())).toEqual([]);
  });

  it('encuentra el día en que se registró un ejercicio de la sesión, distinto al planificado', () => {
    const doneByDay = new Map([['2026-07-08', new Set(['e1'])]]);
    expect(offScheduleDayKeys(['e1', 'e2'], weekKeys, '2026-07-06', doneByDay)).toEqual(['2026-07-08']);
  });

  it('excluye el propio día planificado aunque tenga registros', () => {
    const doneByDay = new Map([['2026-07-06', new Set(['e1'])]]);
    expect(offScheduleDayKeys(['e1'], weekKeys, '2026-07-06', doneByDay)).toEqual([]);
  });
});
