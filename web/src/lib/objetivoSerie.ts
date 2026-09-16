// Objetivos POR SET (v45). Regla de herencia: un campo vacío en el set es
// "igual que el ejercicio". Al guardar, el ejercicio lleva los valores del
// set 1 y cada set solo lo que difiere — así la app publicada (que lee el
// ejercicio) sigue correcta y editar el ejercicio aplica a los sets sin valor propio.
//
// ESPEJO: idéntico en web/src/lib y trainer-app/src/lib, con los mismos
// casos de test (proyectos npm separados, ver CLAUDE.md).

export type EscalaIntensidad = 'rir' | 'rpe' | 'pct_1rm' | 'kg';
export type TipoVolumen = 'reps' | 'tiempo';
export type TipoSet = 'efectiva' | 'calentamiento' | 'drop' | 'fallo';

export const ESCALAS: EscalaIntensidad[] = ['rir', 'rpe', 'pct_1rm', 'kg'];
export const TIPOS_SET: TipoSet[] = ['efectiva', 'calentamiento', 'drop', 'fallo'];

/** Campos de objetivo tal como están en la base (ejercicio o set). */
export interface CamposObjetivo {
  reps_objective?: string | null;
  rest_seconds?: number | null;
  tempo?: string | null;
  target_rir?: string | null;
  target_rpe?: string | null;
  target_pct_1rm?: string | null;
  ref_weight?: number | null;
}
export interface CamposSerie extends CamposObjetivo {
  set_type?: string | null;
}

/** Un set con todo resuelto (lo que ve el editor y el alumno). */
export interface SerieResuelta {
  reps: string;
  rest_seconds: number | null;
  tempo: string;
  rir: string;
  rpe: string;
  pct_1rm: string;
  ref_weight: number | null;
  set_type: TipoSet;
}

const txt = (v?: string | null) => (v ?? '').trim();
const esTipoSet = (v?: string | null): v is TipoSet => TIPOS_SET.includes(v as TipoSet);

export function resolverSerie(ej: CamposObjetivo, s: CamposSerie): SerieResuelta {
  const hereda = (propio?: string | null, base?: string | null) => (txt(propio) !== '' ? txt(propio) : txt(base));
  return {
    reps: hereda(s.reps_objective, ej.reps_objective),
    rest_seconds: s.rest_seconds ?? ej.rest_seconds ?? null,
    tempo: hereda(s.tempo, ej.tempo),
    rir: hereda(s.target_rir, ej.target_rir),
    rpe: hereda(s.target_rpe, ej.target_rpe),
    pct_1rm: hereda(s.target_pct_1rm, ej.target_pct_1rm),
    ref_weight: s.ref_weight ?? ej.ref_weight ?? null,
    set_type: esTipoSet(s.set_type) ? s.set_type : 'efectiva',
  };
}

const nullSiVacio = (v: string) => (v.trim() === '' ? null : v.trim());

/** Lo que se guarda: el ejercicio = set 1; cada set = solo lo distinto del set 1.
 *
 * OJO con los vacíos: en un set, NULL significa "heredar". Si el set 1 tiene
 * 80/85% y el set 2 lo tiene vacío, guardar NULL en el set 2 lo haría heredar
 * 80/85%. Por eso, por cada campo: si ALGÚN set lo tiene vacío, el ejercicio
 * lo guarda vacío y cada set con valor lo guarda como propio. */
export function aplanarSeries(series: SerieResuelta[]): {
  ejercicio: Required<CamposObjetivo>;
  series: Required<CamposSerie>[];
} {
  const primero = series[0] ?? resolverSerie({}, {});
  const txtBase = (f: (s: SerieResuelta) => string) =>
    series.some((s) => f(s).trim() === '') ? '' : f(primero).trim();
  const numBase = (f: (s: SerieResuelta) => number | null) =>
    series.some((s) => f(s) == null) ? null : f(primero);

  const base = {
    reps: txtBase((s) => s.reps),
    rest_seconds: numBase((s) => s.rest_seconds),
    tempo: txtBase((s) => s.tempo),
    rir: txtBase((s) => s.rir),
    rpe: txtBase((s) => s.rpe),
    pct_1rm: txtBase((s) => s.pct_1rm),
    ref_weight: numBase((s) => s.ref_weight),
  };
  const ejercicio: Required<CamposObjetivo> = {
    reps_objective: nullSiVacio(base.reps),
    rest_seconds: base.rest_seconds,
    tempo: nullSiVacio(base.tempo),
    target_rir: nullSiVacio(base.rir),
    target_rpe: nullSiVacio(base.rpe),
    target_pct_1rm: nullSiVacio(base.pct_1rm),
    ref_weight: base.ref_weight,
  };
  // con la base así elegida, un set distinto de la base nunca está vacío
  const distinto = (v: string, b: string) => (v.trim() === b ? null : nullSiVacio(v));
  return {
    ejercicio,
    series: series.map((s) => ({
      reps_objective: distinto(s.reps, base.reps),
      rest_seconds: s.rest_seconds === base.rest_seconds ? null : s.rest_seconds,
      tempo: distinto(s.tempo, base.tempo),
      target_rir: distinto(s.rir, base.rir),
      target_rpe: distinto(s.rpe, base.rpe),
      target_pct_1rm: distinto(s.pct_1rm, base.pct_1rm),
      ref_weight: s.ref_weight === base.ref_weight ? null : s.ref_weight,
      set_type: s.set_type === 'efectiva' ? null : s.set_type,
    })),
  };
}

const ETIQUETA_TIPO: Record<TipoSet, string> = {
  efectiva: '', calentamiento: 'Calentamiento', drop: 'Drop set', fallo: 'Al fallo',
};

/** "Drop set · 12-15 reps · RIR 2 · 80/85% · 60 kg · Tempo 3-1-1-0" — solo lo que hay. */
export function lineaSerie(
  s: SerieResuelta,
  escalas: readonly string[],
  volumen: string,
  unidad: string,
): string {
  const pct = s.pct_1rm.replace(/%+$/, '').trim();
  const intensidades = escalas.map((e) =>
    e === 'rir' ? (s.rir ? `RIR ${s.rir}` : null)
    : e === 'rpe' ? (s.rpe ? `RPE ${s.rpe}` : null)
    : e === 'pct_1rm' ? (pct ? `${pct}%` : null)
    : e === 'kg' ? (s.ref_weight != null ? `${s.ref_weight} ${unidad}` : null)
    : null);
  return [
    ETIQUETA_TIPO[s.set_type] || null,
    s.reps ? `${s.reps} ${volumen === 'tiempo' ? 's' : 'reps'}` : null,
    ...intensidades,
    s.tempo ? `Tempo ${s.tempo}` : null,
  ].filter(Boolean).join(' · ');
}

/** Descanso en min:seg para los dos campos del editor. */
export function partirDescanso(seg: number | null): { min: string; seg: string } {
  if (seg == null) return { min: '', seg: '' };
  return { min: String(Math.floor(seg / 60)), seg: String(seg % 60).padStart(2, '0') };
}
export function unirDescanso(min: string, seg: string): number | null {
  const m = min.trim() === '' ? 0 : Number(min);
  const s = seg.trim() === '' ? 0 : Number(seg);
  if (min.trim() === '' && seg.trim() === '') return null;
  if (!Number.isFinite(m) || !Number.isFinite(s) || m < 0 || s < 0) return null;
  return Math.min(3600, Math.round(m) * 60 + Math.round(s));
}
