import { describe, it, expect } from 'vitest';
import { weekNumberForDate, monthGrid } from '../weeks';

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
