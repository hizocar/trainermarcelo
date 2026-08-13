import { describe, it, expect } from 'vitest';
import {
  weekNumberForDate, monthGrid, calendarWeekNumberForDate, santiagoDayKey,
  weekDates, localDateKey, offScheduleDayKeys,
} from '../weeks';

// El epoch del programa es el lunes 15 de junio de 2026 (semana 1).
describe('weekNumberForDate', () => {
  it('el propio día del epoch es la semana 1', () => {
    expect(weekNumberForDate(new Date('2026-06-15T10:00:00'))).toBe(1);
  });

  it('el domingo siguiente sigue siendo la semana 1', () => {
    expect(weekNumberForDate(new Date('2026-06-21T23:00:00'))).toBe(1);
  });

  it('el lunes siguiente ya es la semana 2', () => {
    expect(weekNumberForDate(new Date('2026-06-22T00:30:00'))).toBe(2);
  });

  it('el 12 de agosto de 2026 es la semana 9', () => {
    expect(weekNumberForDate(new Date('2026-08-12T10:00:00'))).toBe(9);
  });

  it('nunca devuelve menos de 1 para fechas anteriores al epoch', () => {
    expect(weekNumberForDate(new Date('2026-01-01T10:00:00'))).toBe(1);
  });
});

describe('monthGrid', () => {
  it('agosto 2026 ocupa 6 filas de 7 días', () => {
    const grid = monthGrid(2026, 7);
    expect(grid).toHaveLength(6);
    grid.forEach((row) => expect(row).toHaveLength(7));
  });

  it('empieza el lunes anterior al día 1 del mes', () => {
    // el 1 de agosto de 2026 es sábado -> la grilla parte el lunes 27 de julio
    const grid = monthGrid(2026, 7);
    expect(grid[0][0].toDateString()).toBe('Mon Jul 27 2026');
  });

  it('cubre hasta el último día del mes', () => {
    const grid = monthGrid(2026, 7);
    const ultimo = grid[grid.length - 1][6];
    expect(ultimo.getTime()).toBeGreaterThanOrEqual(new Date(2026, 7, 31).getTime());
  });

  it('todas las filas empiezan en lunes', () => {
    monthGrid(2026, 7).forEach((row) => expect(row[0].getDay()).toBe(1));
  });
});

describe('calendarWeekNumberForDate', () => {
  it('el propio día del epoch es la semana 1', () => {
    expect(calendarWeekNumberForDate(new Date('2026-06-15T10:00:00'))).toBe(1);
  });

  it('el 12 de agosto de 2026 es la semana 9', () => {
    expect(calendarWeekNumberForDate(new Date('2026-08-12T10:00:00'))).toBe(9);
  });

  it('devuelve null para fechas anteriores al epoch, en vez de achicarlas a la semana 1', () => {
    expect(calendarWeekNumberForDate(new Date('2026-05-01T10:00:00'))).toBeNull();
    expect(calendarWeekNumberForDate(new Date('2026-01-01T10:00:00'))).toBeNull();
  });

  it('el día justo antes del epoch es null', () => {
    expect(calendarWeekNumberForDate(new Date('2026-06-14T23:00:00'))).toBeNull();
  });
});

describe('santiagoDayKey', () => {
  it('una hora de madrugada UTC todavía es el día anterior en Chile', () => {
    expect(santiagoDayKey(new Date('2026-08-13T02:00:00Z'))).toBe('2026-08-12');
  });

  it('al mediodía UTC ya es el mismo día en Chile', () => {
    expect(santiagoDayKey(new Date('2026-08-13T12:00:00Z'))).toBe('2026-08-13');
  });

  it('formatea como YYYY-MM-DD', () => {
    expect(santiagoDayKey(new Date('2026-01-05T18:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('weekDates', () => {
  it('devuelve 7 fechas de lunes a domingo para la semana 1 (el epoch)', () => {
    const dates = weekDates(1);
    expect(dates).toHaveLength(7);
    expect(dates.map((d) => d.getDay())).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(localDateKey(dates[0])).toBe('2026-06-15');
    expect(localDateKey(dates[6])).toBe('2026-06-21');
  });

  it('la semana 9 empieza el 10 de agosto de 2026', () => {
    const dates = weekDates(9);
    expect(localDateKey(dates[0])).toBe('2026-08-10');
    expect(localDateKey(dates[6])).toBe('2026-08-16');
  });
});

describe('localDateKey', () => {
  it('formatea como YYYY-MM-DD a partir de los componentes locales', () => {
    expect(localDateKey(new Date(2026, 7, 5))).toBe('2026-08-05');
  });
});

describe('offScheduleDayKeys', () => {
  const weekKeys = weekDates(9).map((d) => localDateKey(d)); // lun 10 ago .. dom 16 ago

  it('sin ejercicios, no hay días fuera de lo planificado', () => {
    const doneByDay = new Map([['2026-08-12', new Set(['ex1'])]]);
    expect(offScheduleDayKeys([], weekKeys, '2026-08-10', doneByDay)).toEqual([]);
  });

  it('detecta el día en que se registró un ejercicio de la sesión, distinto del planificado', () => {
    const doneByDay = new Map([['2026-08-12', new Set(['ex1', 'ex2'])]]);
    expect(offScheduleDayKeys(['ex1'], weekKeys, '2026-08-10', doneByDay)).toEqual(['2026-08-12']);
  });

  it('el propio día planificado nunca cuenta como "fuera de lo planificado"', () => {
    const doneByDay = new Map([['2026-08-10', new Set(['ex1'])]]);
    expect(offScheduleDayKeys(['ex1'], weekKeys, '2026-08-10', doneByDay)).toEqual([]);
  });

  it('una sesión partida en dos días devuelve ambos, en orden de la semana', () => {
    const doneByDay = new Map([
      ['2026-08-13', new Set(['ex1'])],
      ['2026-08-12', new Set(['ex2'])],
    ]);
    expect(offScheduleDayKeys(['ex1', 'ex2'], weekKeys, '2026-08-10', doneByDay))
      .toEqual(['2026-08-12', '2026-08-13']);
  });

  it('un registro en un día fuera de la semana de programa no cuenta', () => {
    const doneByDay = new Map([['2026-08-17', new Set(['ex1'])]]); // lunes de la semana 10
    expect(offScheduleDayKeys(['ex1'], weekKeys, '2026-08-10', doneByDay)).toEqual([]);
  });
});
