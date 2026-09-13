// Ranking del buscador de biblioteca. El bug que lo motivó: la consulta
// hacía ilike + limit(6) SIN orden — Postgres devolvía 6 filas arbitrarias
// entre 841 ejercicios, así que "press banca" mostraba rebuscados y los
// ejercicios propios recién creados no aparecían nunca ("no se guardan").
//
// La regla: coincidencia exacta > empieza con la búsqueda > una palabra
// empieza con la búsqueda > la contiene. A igualdad, primero los del propio
// coach, luego el nombre más corto (el "básico" suele ser el corto:
// "Press banca" antes que "Press banca agarre cerrado inclinado").
//
// ESPEJO de web/src/lib/libraryRank.ts — mismos casos de test.

export interface RankeableLib {
  name: string;
  name_en?: string | null;
  coach_id?: string | null;
}

/** minúsculas y sin tildes, para que "prés" encuentre "press" */
export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function puntaje(nombre: string, q: string): number {
  const n = normalizar(nombre);
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  // en un límite de palabra — funciona también con búsquedas de varias
  // palabras ("press banca" dentro de "máquina press banca")
  if ((' ' + n).includes(' ' + q)) return 2;
  if (n.includes(q)) return 3;
  return 9;
}

export function rankearBiblioteca<T extends RankeableLib>(items: T[], query: string, miCoachId?: string | null): T[] {
  const q = normalizar(query);
  return items
    .map((it) => {
      const s = Math.min(puntaje(it.name, q), it.name_en ? puntaje(it.name_en, q) : 9);
      return { it, s };
    })
    .filter(({ s }) => s < 9)
    .sort((a, b) => {
      if (a.s !== b.s) return a.s - b.s;
      const aMio = miCoachId && a.it.coach_id === miCoachId ? 0 : 1;
      const bMio = miCoachId && b.it.coach_id === miCoachId ? 0 : 1;
      if (aMio !== bMio) return aMio - bMio;
      if (a.it.name.length !== b.it.name.length) return a.it.name.length - b.it.name.length;
      return a.it.name.localeCompare(b.it.name);
    })
    .map(({ it }) => it);
}
