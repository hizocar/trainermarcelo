import { describe, it, expect } from 'vitest';
import { semanaDeFecha, lunesDeSemana, etiquetaLunes, sumarDias } from '../semanaUTC';

// El caso que rompió producción: tras el cambio de hora de septiembre en
// Chile, la resta en hora local dejaba los lunes con una hora menos y el
// floor los corría a la semana anterior. La aritmética UTC no puede.
describe('semanaUTC', () => {
  it('los lunes post cambio de hora caen en SU semana (el bug del 7/14 sep)', () => {
    expect(semanaDeFecha(new Date(2026, 8, 7))).toBe(13);   // lun 7 sep
    expect(semanaDeFecha(new Date(2026, 8, 13))).toBe(13);  // dom 13 sep, misma semana
    expect(semanaDeFecha(new Date(2026, 8, 14))).toBe(14);  // lun 14 sep, la siguiente
  });

  it('ida y vuelta exacta: lunesDeSemana(semanaDeFecha(lunes)) es el mismo lunes', () => {
    for (const lunes of [new Date(2026, 5, 15), new Date(2026, 8, 7), new Date(2027, 0, 4)]) {
      const vuelta = lunesDeSemana(semanaDeFecha(lunes));
      expect([vuelta.getFullYear(), vuelta.getMonth(), vuelta.getDate()])
        .toEqual([lunes.getFullYear(), lunes.getMonth(), lunes.getDate()]);
    }
  });

  it('coincide con la fórmula del servidor (UTC puro, como Vercel y las edge)', () => {
    // el servidor: new Date('YYYY-MM-DDT00:00:00') en runtime UTC
    const servidor = (key: string) => {
      const d = new Date(`${key}T00:00:00Z`);
      return Math.max(1, Math.floor((d.getTime() - Date.UTC(2026, 5, 15)) / (7 * 86400000)) + 1);
    };
    expect(semanaDeFecha(new Date(2026, 8, 7))).toBe(servidor('2026-09-07'));
    expect(semanaDeFecha(new Date(2026, 8, 14))).toBe(servidor('2026-09-14'));
    expect(semanaDeFecha(new Date(2026, 11, 28))).toBe(servidor('2026-12-28'));
  });

  it('la etiqueta dice el lunes correcto', () => {
    expect(etiquetaLunes(semanaDeFecha(new Date(2026, 8, 14)))).toBe('lun 14 sep');
  });

  it('la época es la semana 1', () => {
    expect(semanaDeFecha(new Date(2026, 5, 15))).toBe(1);
    expect(semanaDeFecha(new Date(2026, 5, 21))).toBe(1);
  });

  it('sumarDias es calendario puro: cruza mes, año y el cambio de hora', () => {
    // el término sugerido de un programa: inicio + semanas*7 - 1
    expect(sumarDias('2026-09-14', 3 * 7 - 1)).toBe('2026-10-04');
    expect(sumarDias('2026-09-30', 1)).toBe('2026-10-01');
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    // atraviesa el 5-6 sep (DST chileno) sin perder un día
    expect(sumarDias('2026-09-04', 7)).toBe('2026-09-11');
    expect(sumarDias('2026-02-28', 1)).toBe('2026-03-01');
  });
});
