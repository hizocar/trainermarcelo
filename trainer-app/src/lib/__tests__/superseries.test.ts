import {
  nextGroupLabel, chainWith, unchain, dissolveGroup, groupNameFor, colorForLabel,
  normalizeGroups, superseriarSeleccion,
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

  it('con todas las letras usadas nunca devuelve una etiqueta ya ocupada', () => {
    const usadas = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
      'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
    expect(usadas).not.toContain(nextGroupLabel(usadas));
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

  it('encadenar no deja grupos huérfanos de un solo ejercicio', () => {
    const lista = [ej('1', 'A'), ej('2', 'A'), ej('3'), ej('4', 'B'), ej('5', 'B')];
    const r = chainWith(lista, '4');
    // el 4 se va con el 3; el 5 se queda solo, así que su grupo se disuelve
    expect(r.find(e => e.id === '5')!.superseries_group).toBeNull();
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

  it('una etiqueta repetida pero no consecutiva no es un grupo real, y se limpia', () => {
    // "1" y "3" comparten etiqueta A pero "2" está en el medio sin ella:
    // groupBySuperseries jamás los uniría, así que no cuenta como grupo
    const lista = [ej('1', 'A'), ej('2'), ej('3', 'A'), ej('4', 'B'), ej('5', 'B')];
    expect(dissolveGroup(lista, 'B')).toEqual([
      ej('1'), ej('2'), ej('3'), ej('4'), ej('5'),
    ]);
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

describe('normalizeGroups', () => {
  // se usa al CARGAR el plan: una escritura que quedó a medias, o una etiqueta
  // huérfana de planes viejos, no debe dibujar una píldora de grupo sobre un
  // ejercicio suelto
  it('limpia un grupo de un solo miembro', () => {
    const lista = [ej('1', 'A'), ej('2'), ej('3')];
    expect(normalizeGroups(lista)).toEqual([ej('1'), ej('2'), ej('3')]);
  });

  it('deja intacto un grupo real de dos consecutivos', () => {
    const lista = [ej('1', 'A'), ej('2', 'A'), ej('3')];
    expect(normalizeGroups(lista)).toEqual(lista);
  });

  it('limpia una etiqueta repetida en ejercicios no consecutivos', () => {
    const lista = [ej('1', 'A'), ej('2'), ej('3', 'A')];
    expect(normalizeGroups(lista)).toEqual([ej('1'), ej('2'), ej('3')]);
  });

  it('no altera el orden de la lista', () => {
    const lista = [ej('1', 'A'), ej('2'), ej('3', 'B'), ej('4', 'B')];
    expect(normalizeGroups(lista).map(e => e.id)).toEqual(['1', '2', '3', '4']);
  });

  // los dos productores de etiquetas huérfanas en el editor del coach
  it('borrar un miembro de una biserie deja al superviviente sin etiqueta', () => {
    const biserie = [ej('1', 'A'), ej('2', 'A'), ej('3')];
    const restante = biserie.filter(e => e.id !== '2');
    expect(normalizeGroups(restante)).toEqual([ej('1'), ej('3')]);
  });

  it('mover un suelto al medio de una biserie disuelve el grupo partido', () => {
    // '3' (suelto) queda entre los dos miembros de A: la etiqueta ya no es
    // consecutiva y groupBySuperseries no la agruparía
    const movida = [ej('1', 'A'), ej('3'), ej('2', 'A')];
    expect(normalizeGroups(movida)).toEqual([ej('1'), ej('3'), ej('2')]);
  });
});

describe('la letra se pide sobre lo guardado, no sobre lo normalizado', () => {
  // el defecto crítico: la lista en pantalla se normaliza al cargar, así que
  // 'A' desaparece de ella aunque siga escrita en la base. Pedir la próxima
  // letra sobre la lista normalizada devolvía 'A' otra vez, y la fila huérfana
  // —que nunca se reescribió— terminaba sumándose al grupo nuevo.
  const crudas = [ej('1', 'A'), ej('2'), ej('3')]; // 'A' huérfana en la base
  const enPantalla = normalizeGroups(crudas);

  it('la normalización solo limpia lo que se muestra', () => {
    expect(enPantalla[0].superseries_group).toBeNull();
    expect(crudas[0].superseries_group).toBe('A');
  });

  it('encadenar 2 y 3 sobre la lista en pantalla vuelve a elegir A', () => {
    const resultado = chainWith(enPantalla, '3');
    expect(resultado.map(e => e.superseries_group)).toEqual([null, 'A', 'A']);
    // por eso `persistGroups` compara contra las filas crudas: '1' difiere
    // ('A' guardada vs null en pantalla) y se limpia en la misma operación
    const aEscribir = resultado.filter(
      (e, i) => e.superseries_group !== crudas[i].superseries_group,
    );
    expect(aEscribir.map(e => e.id)).toEqual(['1', '2', '3']);
  });
});

describe('superseriarSeleccion', () => {
  const ej = (id: string, g: string | null = null) => ({ id, superseries_group: g });

  it('dos adyacentes: mismo orden, etiqueta nueva para ambos', () => {
    const r = superseriarSeleccion([ej('1'), ej('2'), ej('3')], ['1', '2']);
    expect(r.map(e => e.id)).toEqual(['1', '2', '3']);
    expect(r.map(e => e.superseries_group)).toEqual(['A', 'A', null]);
  });

  it('no adyacentes: se juntan donde está el primero, el resto conserva su orden', () => {
    const r = superseriarSeleccion([ej('1'), ej('2'), ej('3'), ej('4')], ['1', '3']);
    expect(r.map(e => e.id)).toEqual(['1', '3', '2', '4']);
    expect(r.map(e => e.superseries_group)).toEqual(['A', 'A', null, null]);
  });

  it('el orden de la selección es el del plan, no el de los toques', () => {
    const r = superseriarSeleccion([ej('1'), ej('2'), ej('3')], ['3', '1']);
    expect(r.map(e => e.id)).toEqual(['1', '3', '2']);
  });

  it('sacar un miembro de una biserie existente disuelve lo que queda de ella', () => {
    // 1-2 son biserie A; superseriar 2 con 4 deja a 1 solo → pierde la etiqueta
    const r = superseriarSeleccion(
      [ej('1', 'A'), ej('2', 'A'), ej('3'), ej('4')], ['2', '4'],
    );
    expect(r.map(e => e.id)).toEqual(['1', '2', '4', '3']);
    expect(r.map(e => e.superseries_group)).toEqual([null, 'B', 'B', null]);
  });

  it('la etiqueta nueva salta las que ya están ocupadas', () => {
    const r = superseriarSeleccion(
      [ej('1', 'A'), ej('2', 'A'), ej('3'), ej('4')], ['3', '4'],
    );
    expect(r.map(e => e.superseries_group)).toEqual(['A', 'A', 'B', 'B']);
  });

  it('con menos de dos seleccionados presentes no cambia nada', () => {
    const lista = [ej('1'), ej('2')];
    expect(superseriarSeleccion(lista, ['1'])).toEqual(lista);
    expect(superseriarSeleccion(lista, ['no-existe', '1'])).toEqual(lista);
  });

  it('tres seleccionados quedan como triserie consecutiva', () => {
    const r = superseriarSeleccion(
      [ej('1'), ej('2'), ej('3'), ej('4'), ej('5')], ['1', '3', '5'],
    );
    expect(r.map(e => e.id)).toEqual(['1', '3', '5', '2', '4']);
    expect(r.map(e => e.superseries_group)).toEqual(['A', 'A', 'A', null, null]);
  });
});
