import { rankearBiblioteca, normalizar } from '../bibliotecaRank';

// Mismos casos que web/src/lib/__tests__/libraryRank.test.ts:
// si un lado cambia la regla y el otro no, los tests divergen y lo delatan.

const lib = (name: string, coach_id: string | null = null, name_en: string | null = null) =>
  ({ name, coach_id, name_en });

describe('rankearBiblioteca', () => {
  it('el básico gana: exacto > empieza > palabra > contiene', () => {
    const r = rankearBiblioteca([
      lib('Press banca agarre cerrado'),
      lib('Máquina press banca inclinado'),
      lib('Press banca'),
      lib('Floor press banca alterna'),
    ], 'press banca');
    expect(r.map(x => x.name)).toEqual([
      'Press banca',                    // exacto
      'Press banca agarre cerrado',     // empieza con la búsqueda
      'Floor press banca alterna',      // límite de palabra, nombre más corto
      'Máquina press banca inclinado',  // límite de palabra
    ]);
  });

  it('a igual puntaje, primero los ejercicios del propio coach', () => {
    const r = rankearBiblioteca([
      lib('Remo especial'),
      lib('Remo especial', 'yo'),
    ], 'remo esp', 'yo');
    expect(r[0].coach_id).toBe('yo');
  });

  it('a igual puntaje, el nombre corto (el básico) antes que el rebuscado', () => {
    const r = rankearBiblioteca([lib('Sentadilla búlgara con salto'), lib('Sentadilla')], 'sentadilla');
    expect(r[0].name).toBe('Sentadilla');
  });

  it('busca sin tildes y en el nombre en inglés', () => {
    expect(normalizar('Prés')).toBe('pres');
    const r = rankearBiblioteca([lib('Peso muerto rumano', null, 'Romanian deadlift')], 'romanian');
    expect(r).toHaveLength(1);
  });

  it('lo que no coincide, fuera', () => {
    expect(rankearBiblioteca([lib('Curl bíceps')], 'sentadilla')).toHaveLength(0);
  });
});
