import {
  nextGroupLabel, chainWith, unchain, dissolveGroup, groupNameFor, colorForLabel,
} from '../superseries';

const ej = (id: string, g: string | null = null) => ({ id, superseries_group: g });

describe('nextGroupLabel', () => {
  it('sin grupos empieza en A', () => {
    expect(nextGroupLabel([null, null])).toBe('A');
  });

  it('con A usada sigue B', () => {
    expect(nextGroupLabel(['A', 'A', null])).toBe('B');
  });

  it('con A y C usadas rellena el hueco: B', () => {
    expect(nextGroupLabel(['A', 'C'])).toBe('B');
  });

  it('las etiquetas viejas escritas a mano no ocupan letras', () => {
    // planes hechos antes de este cambio tienen cosas como "Superserie 1"
    expect(nextGroupLabel(['Superserie 1', null])).toBe('A');
  });
});

describe('chainWith', () => {
  it('une un ejercicio con el de arriba creando el grupo A', () => {
    const lista = [ej('1'), ej('2'), ej('3')];
    expect(chainWith(lista, '2')).toEqual([
      ej('1', 'A'), ej('2', 'A'), ej('3'),
    ]);
  });

  it('encadenar al siguiente convierte la biserie en triserie, sin letra nueva', () => {
    const lista = [ej('1', 'A'), ej('2', 'A'), ej('3')];
    expect(chainWith(lista, '3')).toEqual([
      ej('1', 'A'), ej('2', 'A'), ej('3', 'A'),
    ]);
  });

  it('un grupo nuevo bajo uno existente toma la letra siguiente', () => {
    const lista = [ej('1', 'A'), ej('2', 'A'), ej('3'), ej('4')];
    expect(chainWith(lista, '4')).toEqual([
      ej('1', 'A'), ej('2', 'A'), ej('3', 'B'), ej('4', 'B'),
    ]);
  });

  it('el primero de la lista no tiene con quién encadenarse: no cambia nada', () => {
    const lista = [ej('1'), ej('2')];
    expect(chainWith(lista, '1')).toEqual(lista);
  });

  it('un id que no está en la lista no cambia nada', () => {
    const lista = [ej('1'), ej('2')];
    expect(chainWith(lista, 'fantasma')).toEqual(lista);
  });

  it('no altera el orden de la lista', () => {
    const lista = [ej('1'), ej('2'), ej('3')];
    expect(chainWith(lista, '2').map(e => e.id)).toEqual(['1', '2', '3']);
  });
});

describe('unchain', () => {
  it('sacar uno de una biserie disuelve el grupo entero', () => {
    // el que queda solo deja de ser superserie: un grupo de uno no es un grupo
    const lista = [ej('1', 'A'), ej('2', 'A'), ej('3')];
    expect(unchain(lista, '2')).toEqual([ej('1'), ej('2'), ej('3')]);
  });

  it('sacar uno de una triserie la deja como biserie', () => {
    const lista = [ej('1', 'A'), ej('2', 'A'), ej('3', 'A')];
    expect(unchain(lista, '3')).toEqual([
      ej('1', 'A'), ej('2', 'A'), ej('3'),
    ]);
  });

  it('sacar un ejercicio sin grupo no cambia nada', () => {
    const lista = [ej('1'), ej('2')];
    expect(unchain(lista, '1')).toEqual(lista);
  });
});

describe('dissolveGroup', () => {
  it('deshace el grupo completo y deja el resto intacto', () => {
    const lista = [ej('1', 'A'), ej('2', 'A'), ej('3', 'B'), ej('4', 'B')];
    expect(dissolveGroup(lista, 'A')).toEqual([
      ej('1'), ej('2'), ej('3', 'B'), ej('4', 'B'),
    ]);
  });

  it('sirve para las etiquetas viejas escritas a mano', () => {
    const lista = [ej('1', 'Superserie 1'), ej('2', 'Superserie 1')];
    expect(dissolveGroup(lista, 'Superserie 1')).toEqual([ej('1'), ej('2')]);
  });
});

describe('groupNameFor', () => {
  it('dos ejercicios son una biserie', () => {
    expect(groupNameFor(2, 'A')).toBe('BISERIE A');
  });

  it('tres son una triserie', () => {
    expect(groupNameFor(3, 'A')).toBe('TRISERIE A');
  });

  it('cuatro o más son una superserie', () => {
    expect(groupNameFor(4, 'B')).toBe('SUPERSERIE B');
  });
});

describe('colorForLabel', () => {
  it('la misma etiqueta da siempre el mismo color', () => {
    expect(colorForLabel('A')).toBe(colorForLabel('A'));
  });

  it('etiquetas distintas dan colores distintos', () => {
    expect(colorForLabel('A')).not.toBe(colorForLabel('B'));
  });

  it('una etiqueta vieja escrita a mano también recibe color', () => {
    expect(typeof colorForLabel('Superserie 1')).toBe('string');
  });
});
