import { describe, it, expect } from 'vitest';
import { etiquetaAnimo, animoPromedio, formatoDuracion, adherencia } from '../tracking';

// Los casos del ánimo son los MISMOS de trainer-app (mood.ts): si un lado
// cambia la escala y el otro no, estos tests divergen y lo delatan.
describe('etiquetaAnimo', () => {
  it('mapea los valores pares de las cinco caras', () => {
    expect(etiquetaAnimo(2)).toBe('Muy cansado');
    expect(etiquetaAnimo(4)).toBe('Cansado');
    expect(etiquetaAnimo(6)).toBe('Normal');
    expect(etiquetaAnimo(8)).toBe('Con energía');
    expect(etiquetaAnimo(10)).toBe('Con mucha energía');
  });

  it('los impares históricos empatan HACIA ABAJO: 7 es Normal, no Con energía', () => {
    expect(etiquetaAnimo(7)).toBe('Normal');
    expect(etiquetaAnimo(3)).toBe('Muy cansado');
    expect(etiquetaAnimo(9)).toBe('Con energía');
  });

  it('recorta fuera de rango y rechaza lo ilegible', () => {
    expect(etiquetaAnimo(0)).toBe('Muy cansado');
    expect(etiquetaAnimo(15)).toBe('Con mucha energía');
    expect(etiquetaAnimo(NaN)).toBeNull();
  });
});

describe('animoPromedio', () => {
  it('promedia los textos de la base ignorando basura', () => {
    expect(animoPromedio(['6', '8', 'x', '10'])).toBe(8);
  });
  it('null cuando no hay nada legible', () => {
    expect(animoPromedio([])).toBeNull();
    expect(animoPromedio(['?'])).toBeNull();
  });
});

describe('formatoDuracion', () => {
  it('bajo la hora, minutos', () => {
    expect(formatoDuracion(52 * 60 + 59)).toBe('53 min');
    expect(formatoDuracion(90)).toBe('2 min');
  });
  it('sobre la hora, h y minutos con cero a la izquierda', () => {
    expect(formatoDuracion(65 * 60)).toBe('1 h 05');
  });
});

describe('adherencia', () => {
  it('días entrenados sobre planificados del período', () => {
    expect(adherencia(9, 3, 4)).toBe(75);
  });
  it('se recorta a 100 aunque entrene días extra', () => {
    expect(adherencia(15, 3, 4)).toBe(100);
  });
  it('null sin días planificados: no se inventa un porcentaje', () => {
    expect(adherencia(5, 0, 4)).toBeNull();
  });
});
