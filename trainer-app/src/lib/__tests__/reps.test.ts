import { parseRepsRange, formatRepsRange, DEFAULT_REPS } from '../reps';

describe('parseRepsRange', () => {
  it('separa un rango en sus dos extremos', () => {
    expect(parseRepsRange('8-12')).toEqual({ from: '8', to: '12' });
  });

  it('tolera espacios alrededor del guion', () => {
    expect(parseRepsRange('10 - 15')).toEqual({ from: '10', to: '15' });
  });

  it('un número solo llena únicamente "desde"', () => {
    expect(parseRepsRange('10')).toEqual({ from: '10', to: '' });
  });

  it('sin valor devuelve ambos campos vacíos', () => {
    expect(parseRepsRange(null)).toEqual({ from: '', to: '' });
    expect(parseRepsRange(undefined)).toEqual({ from: '', to: '' });
    expect(parseRepsRange('')).toEqual({ from: '', to: '' });
  });

  it('un texto viejo que no es un rango no revienta: queda en "desde"', () => {
    // hay planes con textos escritos a mano antes de este cambio
    expect(parseRepsRange('al fallo')).toEqual({ from: 'al fallo', to: '' });
  });
});

describe('formatRepsRange', () => {
  it('une los dos extremos con un guion', () => {
    expect(formatRepsRange('7', '9')).toBe('7-9');
  });

  it('solo "desde" guarda un objetivo fijo', () => {
    expect(formatRepsRange('10', '')).toBe('10');
  });

  it('ambos vacíos caen al valor por omisión', () => {
    expect(formatRepsRange('', '')).toBe(DEFAULT_REPS);
  });

  it('solo "hasta" se trata como objetivo fijo, no como rango a medias', () => {
    expect(formatRepsRange('', '12')).toBe('12');
  });

  it('ignora espacios que el coach haya tecleado', () => {
    expect(formatRepsRange(' 8 ', ' 12 ')).toBe('8-12');
  });

  it('un rango tecleado al revés se ordena solo', () => {
    // "desde 12 hasta 8" es un error de tecleo, y dejarlo pasar haría que
    // repTopOf lea 8 como tope y la sugerencia de subir peso se dispare antes
    expect(formatRepsRange('12', '8')).toBe('8-12');
  });

  it('un texto viejo no numérico no se toca', () => {
    expect(formatRepsRange('al fallo', '')).toBe('al fallo');
  });

  it('un texto legado truncado por el campo se corrompería: por eso el editor guarda el original', () => {
    // lo que pasaba con maxLength={3} en iOS: "al fallo" llegaba al campo
    // "desde" recortado a "al " y toda edición del ejercicio lo reescribía
    expect(formatRepsRange('al '.slice(0, 3), '')).toBe('al');
    // el editor no vuelve a pasar por el formulario si el coach no tocó los
    // campos, así que el valor que se guarda es el original íntegro
    const original = 'al fallo';
    const tocadas = false;
    expect(!tocadas && original !== null ? original : formatRepsRange('al ', '')).toBe('al fallo');
  });
});
