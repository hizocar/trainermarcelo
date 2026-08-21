import { necesitaConfirmar, textoConfirmacion } from '../overwrite';

describe('necesitaConfirmar', () => {
  it('no molesta al alumno con su propio entrenamiento', () => {
    expect(necesitaConfirmar({ esPropio: true, yaRegistrada: true, desbloqueada: false })).toBe(false);
    expect(necesitaConfirmar({ esPropio: true, yaRegistrada: false, desbloqueada: false })).toBe(false);
  });

  it('el coach escribe directo en una serie vacía', () => {
    expect(necesitaConfirmar({ esPropio: false, yaRegistrada: false, desbloqueada: false })).toBe(false);
  });

  it('el coach tiene que confirmar antes de pisar una serie ya registrada', () => {
    expect(necesitaConfirmar({ esPropio: false, yaRegistrada: true, desbloqueada: false })).toBe(true);
  });

  it('una vez confirmada, no vuelve a preguntar en cada tecla', () => {
    expect(necesitaConfirmar({ esPropio: false, yaRegistrada: true, desbloqueada: true })).toBe(false);
  });
});

describe('textoConfirmacion', () => {
  it('nombra la serie y el valor que se va a perder', () => {
    expect(textoConfirmacion({ seriesNumber: 2, weight: 80, reps: 10 }))
      .toBe('La serie 2 ya tiene 80 kg × 10. ¿Reemplazar?');
  });

  it('no arrastra decimales inventados', () => {
    expect(textoConfirmacion({ seriesNumber: 1, weight: 7.5, reps: 12 }))
      .toBe('La serie 1 ya tiene 7,5 kg × 12. ¿Reemplazar?');
  });

  it('el peso corporal se dice sin kilos', () => {
    expect(textoConfirmacion({ seriesNumber: 3, weight: 0, reps: 8 }))
      .toBe('La serie 3 ya tiene 8 repeticiones. ¿Reemplazar?');
  });
});
