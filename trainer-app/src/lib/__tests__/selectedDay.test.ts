import { pickSelectedDayId, SelectableDay } from '../selectedDay';

const day = (id: string, week_day: number | null): SelectableDay => ({ id, week_day });

describe('pickSelectedDayId', () => {
  it('sin selección previa elige el primer incompleto', () => {
    const days = [day('a', 1), day('b', 2), day('c', 3)];
    const completed = new Set(['a']);
    expect(pickSelectedDayId(days, completed, null, 1, false)).toBe('b');
  });

  it('una selección previa incompleta se respeta', () => {
    const days = [day('a', 1), day('b', 2), day('c', 3)];
    const completed = new Set<string>();
    expect(pickSelectedDayId(days, completed, 'b', 1, false)).toBe('b');
  });

  it('una selección previa que pasa de incompleta a completa avanza al siguiente incompleto', () => {
    const days = [day('a', 1), day('b', 2), day('c', 3)];
    const completed = new Set(['a']);
    // 'a' no estaba completa la vuelta anterior (previousSelectionWasComplete: false)
    // y ahora sí: es la transición que gatilla el avance.
    expect(pickSelectedDayId(days, completed, 'a', 1, false)).toBe('b');
  });

  it('una selección previa que YA estaba completa se respeta (revisar un día viejo)', () => {
    const days = [day('a', 1), day('b', 2), day('c', 3)];
    const completed = new Set(['a', 'c']);
    // 'c' ya estaba completo en la vuelta anterior: el alumno lo eligió para
    // revisarlo. No debe expulsarlo al siguiente incompleto aunque 'b' lo esté.
    expect(pickSelectedDayId(days, completed, 'c', 1, true)).toBe('c');
  });

  it('salta dando la vuelta cuando el completado es el último', () => {
    const days = [day('a', 1), day('b', 2), day('c', 3)];
    const completed = new Set(['c']);
    expect(pickSelectedDayId(days, completed, 'c', 1, false)).toBe('a');
  });

  it('todos completos se queda donde estaba', () => {
    const days = [day('a', 1), day('b', 2), day('c', 3)];
    const completed = new Set(['a', 'b', 'c']);
    expect(pickSelectedDayId(days, completed, 'b', 1, false)).toBe('b');
  });

  it('un id que ya no existe en la lista cae al fallback normal', () => {
    const days = [day('a', 1), day('b', 2), day('c', 3)];
    const completed = new Set(['a']);
    expect(pickSelectedDayId(days, completed, 'zzz', 1, false)).toBe('b');
  });

  it('lista vacía devuelve null', () => {
    expect(pickSelectedDayId([], new Set(), 'a', 1, false)).toBeNull();
  });

  it('sin selección previa y todos incompletos, ninguno es hoy: cae al primero', () => {
    const days = [day('a', 1), day('b', 2), day('c', 3)];
    const completed = new Set<string>();
    expect(pickSelectedDayId(days, completed, null, 9, false)).toBe('a');
  });

  it('sin selección previa, todos completos: usa el día de hoy si existe', () => {
    const days = [day('a', 1), day('b', 2), day('c', 3)];
    const completed = new Set(['a', 'b', 'c']);
    // todos completos y sin selección previa: cae al día de hoy
    expect(pickSelectedDayId(days, completed, null, 2, false)).toBe('b');
  });
});
