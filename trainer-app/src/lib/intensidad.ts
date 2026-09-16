// Línea de intensidad objetivo de un ejercicio: "RIR 2 · RPE 8 · 75% 1RM · Tempo 3-1-1-0".
// Solo lo que el coach llenó, en ese orden fijo; vacío si nada.
//
// ESPEJO: existe idéntico en web/src/lib y trainer-app/src/lib (proyectos npm
// separados, ver CLAUDE.md), con los mismos casos de test en ambos lados.

export interface CamposIntensidad {
  target_rir?: string | null;
  target_rpe?: string | null;
  target_pct_1rm?: string | null;
  tempo?: string | null;
}

const limpio = (v?: string | null) => (v ?? '').trim();

export function lineaIntensidad(c: CamposIntensidad): string {
  const rir = limpio(c.target_rir);
  const rpe = limpio(c.target_rpe);
  // "75%" o "75" se escriben igual: el % lo pone la línea
  const pct = limpio(c.target_pct_1rm).replace(/%+$/, '').trim();
  const tempo = limpio(c.tempo);
  return [
    rir ? `RIR ${rir}` : null,
    rpe ? `RPE ${rpe}` : null,
    pct ? `${pct}% 1RM` : null,
    tempo ? `Tempo ${tempo}` : null,
  ].filter(Boolean).join(' · ');
}
