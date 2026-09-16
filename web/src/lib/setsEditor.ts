import { lineaSerie, type SerieResuelta } from './objetivoSerie';
import type { EditSet } from '@/components/SetTable';

// Puente entre la tabla de sets del editor (strings de inputs) y la lógica
// de objetivos (objetivoSerie). Solo web: la app no edita sets todavía.

export function aEditSet(r: SerieResuelta, id: string): EditSet {
  return {
    id, reps: r.reps, rest_seconds: r.rest_seconds, tempo: r.tempo,
    rir: r.rir, rpe: r.rpe, pct_1rm: r.pct_1rm,
    peso: r.ref_weight == null ? '' : String(r.ref_weight),
    set_type: r.set_type,
  };
}

/** "17,5" o "17.5" → 17.5; vacío o basura → null. */
export function pesoANumero(peso: string): number | null {
  const t = peso.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function aResuelta(s: EditSet): SerieResuelta {
  return {
    reps: s.reps, rest_seconds: s.rest_seconds, tempo: s.tempo,
    rir: s.rir, rpe: s.rpe, pct_1rm: s.pct_1rm,
    ref_weight: pesoANumero(s.peso), set_type: s.set_type,
  };
}

/** Línea de la tarjeta: "4 × 12-15 reps · RIR 2" si todos iguales; si no, las reps por set. */
export function resumenSets(sets: EditSet[], escalas: readonly string[], volumen: string, unidad: string): string {
  if (sets.length === 0) return 'sin sets';
  const lineas = sets.map((s) => lineaSerie({ ...aResuelta(s), set_type: 'efectiva' }, escalas, volumen, unidad));
  if (lineas.every((l) => l === lineas[0])) return `${sets.length} × ${lineas[0] || '—'}`;
  const reps = sets.map((s) => s.reps.trim() || '—').join('/');
  return `${sets.length} sets · ${reps}${volumen === 'tiempo' ? ' s' : ''}`;
}
