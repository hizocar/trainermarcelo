import { clientStatus } from '../clientStatus';

const LUN = 1, MAR = 2, MIE = 3, JUE = 4, VIE = 5, SAB = 6, DOM = 0;

describe('clientStatus', () => {
  it('un alumno sin plan no es una alerta', () => {
    expect(clientStatus({
      hasPlan: false, plannedWeekDays: [], completedWeekDays: [], todayWeekDay: MIE,
    })).toEqual({ needsAttention: false, done: 0, total: 0 });
  });

  it('un día planificado que aún no llega no es alerta', () => {
    expect(clientStatus({
      hasPlan: true, plannedWeekDays: [VIE], completedWeekDays: [], todayWeekDay: MIE,
    })).toEqual({ needsAttention: false, done: 0, total: 1 });
  });

  it('el día de HOY sin registrar no es alerta: está en curso', () => {
    expect(clientStatus({
      hasPlan: true, plannedWeekDays: [MIE], completedWeekDays: [], todayWeekDay: MIE,
    })).toEqual({ needsAttention: false, done: 0, total: 1 });
  });

  it('un domingo planificado NO es alerta el lunes: el domingo cierra la semana', () => {
    expect(clientStatus({
      hasPlan: true, plannedWeekDays: [DOM], completedWeekDays: [], todayWeekDay: LUN,
    })).toEqual({ needsAttention: false, done: 0, total: 1 });
  });

  it('un día ya pasado y sin registrar sí es alerta', () => {
    expect(clientStatus({
      hasPlan: true, plannedWeekDays: [LUN, MIE], completedWeekDays: [], todayWeekDay: MIE,
    })).toEqual({ needsAttention: true, done: 0, total: 2 });
  });

  it('una sesión movida a otro día cuenta como cumplida', () => {
    expect(clientStatus({
      hasPlan: true, plannedWeekDays: [LUN, MIE], completedWeekDays: [LUN], todayWeekDay: MIE,
    })).toEqual({ needsAttention: false, done: 1, total: 2 });
  });

  it('la semana completa no es alerta', () => {
    expect(clientStatus({
      hasPlan: true,
      plannedWeekDays: [LUN, MIE, VIE],
      completedWeekDays: [LUN, MIE, VIE],
      todayWeekDay: SAB,
    })).toEqual({ needsAttention: false, done: 3, total: 3 });
  });

  it('un alumno con plan pero sin días planificados no es alerta', () => {
    expect(clientStatus({
      hasPlan: true, plannedWeekDays: [], completedWeekDays: [], todayWeekDay: JUE,
    })).toEqual({ needsAttention: false, done: 0, total: 0 });
  });

  it('ignora días cumplidos que no estaban planificados', () => {
    expect(clientStatus({
      hasPlan: true, plannedWeekDays: [LUN], completedWeekDays: [LUN, SAB], todayWeekDay: MAR,
    })).toEqual({ needsAttention: false, done: 1, total: 1 });
  });

  it('no cuenta dos veces un día repetido', () => {
    expect(clientStatus({
      hasPlan: true, plannedWeekDays: [LUN], completedWeekDays: [LUN, LUN], todayWeekDay: MAR,
    })).toEqual({ needsAttention: false, done: 1, total: 1 });
  });
});
