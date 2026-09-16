'use client';

import { useState } from 'react';
import { lineaIntensidad } from '@/lib/intensidad';

// Intensidad avanzada del ejercicio: %1RM, RPE y tempo. OPCIONAL a propósito
// — la mayoría de los ejercicios se programan con reps + RIR, y estos campos
// en la grilla principal cargaban la tarjeta de quien no los usa. Nace
// cerrada, salvo que el ejercicio ya tenga alguno (así nadie "pierde" un
// valor escondido). Montar con key={ejercicio.id}: el estado inicial se
// decide al abrir cada ejercicio.

export interface ValoresIntensidad {
  target_pct_1rm: string;
  target_rpe: string;
  tempo: string;
}

export default function IntensidadAvanzada({ valores, onChange }: {
  valores: ValoresIntensidad;
  onChange: (patch: Partial<ValoresIntensidad>) => void;
}) {
  // sin RIR: el RIR vive en la grilla principal, a la vista
  const resumen = lineaIntensidad({ target_rpe: valores.target_rpe, target_pct_1rm: valores.target_pct_1rm, tempo: valores.tempo });
  const [abierta, setAbierta] = useState(resumen !== '');

  return (
    <div className="intensidad-av">
      <button
        type="button"
        className="intensidad-av-toggle"
        aria-expanded={abierta}
        onClick={() => setAbierta((a) => !a)}
      >
        <span className="intensidad-av-chevron" aria-hidden="true">{abierta ? '▾' : '▸'}</span>
        <span className="intensidad-av-titulo">Intensidad avanzada</span>
        <span className="intensidad-av-resumen">{abierta ? '%1RM · RPE · Tempo' : (resumen || 'opcional')}</span>
      </button>

      {abierta && (
        <div className="board-card-grid" style={{ marginTop: 10 }}>
          <div className="bfield">
            <span>% 1RM</span>
            <input className="ex-input ex-input-mono" value={valores.target_pct_1rm}
              onChange={(e) => onChange({ target_pct_1rm: e.target.value })}
              placeholder="75-80" inputMode="decimal"
              title="Porcentaje de la repetición máxima. Acepta rangos." />
          </div>
          <div className="bfield">
            <span>RPE</span>
            <input className="ex-input ex-input-mono" value={valores.target_rpe}
              onChange={(e) => onChange({ target_rpe: e.target.value })}
              placeholder="8-9" inputMode="decimal"
              title="Esfuerzo percibido, 1 a 10 (RPE 8 ≈ RIR 2)." />
          </div>
          <div className="bfield">
            <span>Tempo</span>
            <input className="ex-input ex-input-mono" value={valores.tempo}
              onChange={(e) => onChange({ tempo: e.target.value })}
              placeholder="3-1-1-0"
              title="Excéntrica-pausa-concéntrica-pausa, en segundos." />
          </div>
        </div>
      )}
    </div>
  );
}
