import {
  MOOD_FACE_LEVELS,
  moodValueForFace,
  faceForMoodValue,
  faceForMoodText,
  moodFaceLabel,
  moodChartPoints,
  shortDayLabel,
  MoodFaceLevel,
} from '../mood';

describe('moodValueForFace', () => {
  it('mapea las cinco caras a 2/4/6/8/10', () => {
    expect(MOOD_FACE_LEVELS.map(moodValueForFace)).toEqual([2, 4, 6, 8, 10]);
  });

  it('nunca sale de la escala 1-10 de la base', () => {
    MOOD_FACE_LEVELS.forEach(l => {
      const v = moodValueForFace(l);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(10);
    });
  });
});

describe('faceForMoodValue', () => {
  it('devuelve la misma cara para los valores pares que escribe la app', () => {
    expect(faceForMoodValue(2)).toBe(1);
    expect(faceForMoodValue(4)).toBe(2);
    expect(faceForMoodValue(6)).toBe(3);
    expect(faceForMoodValue(8)).toBe(4);
    expect(faceForMoodValue(10)).toBe(5);
  });

  it('ida y vuelta: cara → valor → cara es la identidad', () => {
    MOOD_FACE_LEVELS.forEach(l => {
      expect(faceForMoodValue(moodValueForFace(l))).toBe(l);
    });
  });

  it('lleva los impares históricos a la cara de abajo (el empate no minimiza el cansancio)', () => {
    expect(faceForMoodValue(1)).toBe(1);
    expect(faceForMoodValue(3)).toBe(1);
    expect(faceForMoodValue(5)).toBe(2);
    expect(faceForMoodValue(7)).toBe(3);
    expect(faceForMoodValue(9)).toBe(4);
  });

  it('recorta los valores fuera de rango a los extremos', () => {
    expect(faceForMoodValue(0)).toBe(1);
    expect(faceForMoodValue(-8)).toBe(1);
    expect(faceForMoodValue(11)).toBe(5);
    expect(faceForMoodValue(999)).toBe(5);
  });

  it('devuelve null si el valor no es un número', () => {
    expect(faceForMoodValue(NaN)).toBeNull();
    expect(faceForMoodValue(Infinity)).toBeNull();
  });
});

describe('faceForMoodText', () => {
  it('lee el texto que guarda la base', () => {
    expect(faceForMoodText('7')).toBe(3);
    expect(faceForMoodText('10')).toBe(5);
  });

  it('tolera vacío, null y basura', () => {
    expect(faceForMoodText(null)).toBeNull();
    expect(faceForMoodText(undefined)).toBeNull();
    expect(faceForMoodText('')).toBeNull();
    expect(faceForMoodText('bien')).toBeNull();
  });
});

describe('moodFaceLabel', () => {
  it('da un texto en palabras para cada cara', () => {
    expect(moodFaceLabel(1)).toBe('Muy cansado');
    expect(moodFaceLabel(5)).toBe('Con mucha energía');
    MOOD_FACE_LEVELS.forEach(l => expect(moodFaceLabel(l).length).toBeGreaterThan(0));
  });
});

describe('shortDayLabel', () => {
  it('formatea DD/MM', () => {
    expect(shortDayLabel('2026-08-13')).toBe('13/08');
  });
});

describe('moodChartPoints', () => {
  const rec = (logged_date: string, mood: string) => ({ logged_date, mood });

  it('sin registros devuelve una lista vacía', () => {
    expect(moodChartPoints([])).toEqual([]);
  });

  it('con un solo registro devuelve un punto', () => {
    expect(moodChartPoints([rec('2026-08-13', '7')])).toEqual([{ label: '13/08', value: 7 }]);
  });

  it('ordena cronológicamente aunque el estado venga del más reciente al más antiguo', () => {
    const points = moodChartPoints([
      rec('2026-08-13', '8'),
      rec('2026-08-12', '4'),
      rec('2026-08-10', '6'),
    ]);
    expect(points.map(p => p.label)).toEqual(['10/08', '12/08', '13/08']);
    expect(points.map(p => p.value)).toEqual([6, 4, 8]);
  });

  it('ordena bien cruzando mes y año (comparación por texto ISO)', () => {
    const points = moodChartPoints([
      rec('2027-01-02', '2'),
      rec('2026-12-31', '10'),
      rec('2026-09-01', '6'),
    ]);
    expect(points.map(p => p.label)).toEqual(['01/09', '31/12', '02/01']);
  });

  it('descarta registros ilegibles', () => {
    const points = moodChartPoints([
      rec('2026-08-13', 'bien'),
      rec('2026-08-12', ''),
      rec('2026-08-11', '5'),
    ]);
    expect(points).toEqual([{ label: '11/08', value: 5 }]);
  });

  it('recorta valores fuera de rango para no aplastar la escala', () => {
    const points = moodChartPoints([rec('2026-08-11', '-3'), rec('2026-08-12', '48')]);
    expect(points.map(p => p.value)).toEqual([1, 10]);
  });

  it('no muta el arreglo original', () => {
    const input = [rec('2026-08-13', '8'), rec('2026-08-12', '4')];
    moodChartPoints(input);
    expect(input[0].logged_date).toBe('2026-08-13');
  });
});
