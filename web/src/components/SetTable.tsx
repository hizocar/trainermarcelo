'use client';

import { useState } from 'react';
import {
  TIPOS_SET, leerDescanso, formatoDescanso, DESCANSOS_COMUNES,
  type EscalaIntensidad, type TipoSet, type TipoVolumen,
} from '@/lib/objetivoSerie';

// La tabla de sets del ejercicio (modelo que pidieron Yharel y Marcelo, con
// Traineeks como referencia visual): cada fila es un set con su volumen,
// descanso, tempo e intensidad. Las ESCALAS se eligen una vez en el
// encabezado y cada fila lleva solo valores. La intensidad se LEE como una
// frase ("RIR 2 - 80/85%"): los inputs no tienen caja propia y miden lo que
// su contenido. Agregar un set copia el último: casi siempre se cambia uno.

export interface EditSet {
  id: string;
  reps: string;
  rest_seconds: number | null;
  tempo: string;
  rir: string;
  rpe: string;
  pct_1rm: string;
  /** texto para el input; se convierte a número al guardar */
  peso: string;
  set_type: TipoSet;
}

export interface SetTableProps {
  volumeType: TipoVolumen;
  intensityTypes: EscalaIntensidad[];
  unit: 'kg' | 'lb';
  sets: EditSet[];
  onScales: (patch: { volumeType?: TipoVolumen; intensityTypes?: EscalaIntensidad[]; unit?: 'kg' | 'lb' }) => void;
  onSet: (i: number, patch: Partial<EditSet>) => void;
  onAdd: () => void;
  onDuplicate: (i: number) => void;
  onRemove: (i: number) => void;
}

const NOMBRE_ESCALA: Record<EscalaIntensidad, string> = { rir: 'RIR', rpe: 'RPE', pct_1rm: '%1RM', kg: 'CARGA' };
// Un solo selector (como la referencia): escalas simples y las combinaciones útiles.
const COMBINACIONES: EscalaIntensidad[][] = [
  ['rir'], ['rpe'], ['pct_1rm'], ['kg'],
  ['rir', 'pct_1rm'], ['rpe', 'pct_1rm'], ['rir', 'kg'], ['rpe', 'kg'], ['pct_1rm', 'kg'], ['rir', 'rpe'],
];
const claveCombo = (c: readonly string[]) => c.join('+');

const NOMBRE_TIPO: Record<TipoSet, string> = { efectiva: 'SET', calentamiento: 'CALENT.', drop: 'DROP', fallo: 'FALLO' };
const TIPO_LARGO: Record<TipoSet, string> = { efectiva: 'Set efectivo', calentamiento: 'Calentamiento', drop: 'Drop set', fallo: 'Al fallo' };

const campoDe = (e: EscalaIntensidad): 'rir' | 'rpe' | 'pct_1rm' | 'peso' =>
  e === 'rir' ? 'rir' : e === 'rpe' ? 'rpe' : e === 'pct_1rm' ? 'pct_1rm' : 'peso';

/** ancho del input según su contenido: la celda se lee como texto corrido */
const ancho = (v: string, minimo = 1) => ({ width: `calc(${Math.max(minimo, v.length)}ch + 6px)` });

const IconoCopiar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8 2h11a3 3 0 0 1 3 3v11a1 1 0 0 1-1 1h-1V5a1 1 0 0 0-1-1H7V3a1 1 0 0 1 1-1Z" />
    <rect x="2" y="6" width="16" height="16" rx="3" />
  </svg>
);
const IconoBasura = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M9 2h6a1 1 0 0 1 1 1v1h4a1 1 0 1 1 0 2H4a1 1 0 0 1 0-2h4V3a1 1 0 0 1 1-1Zm-4 6h14l-1 12a3 3 0 0 1-3 2.7H9A3 3 0 0 1 6 20L5 8Zm4 3v8h2v-8H9Zm4 0v8h2v-8h-2Z" />
  </svg>
);

// Descanso en UN campo (antes eran dos cajitas min/seg, incómodas — Yharel):
// se escribe como uno piensa ("90", "2", "1:30", "45s") y al salir queda
// "01:30". Si lo escrito no se entiende, vuelve al valor anterior en vez de
// borrarlo. Enter confirma. La lista trae los descansos habituales.
function CeldaDescanso({ valor, onCambio, etiqueta }: {
  valor: number | null;
  onCambio: (seg: number | null) => void;
  etiqueta: string;
}) {
  const [borrador, setBorrador] = useState<string | null>(null);
  const confirmar = () => {
    if (borrador == null) return;
    const seg = leerDescanso(borrador);
    if (seg !== undefined && seg !== valor) onCambio(seg);
    setBorrador(null);
  };
  return (
    <input
      className="set-cell"
      list="descansos-comunes"
      value={borrador ?? formatoDescanso(valor)}
      aria-label={etiqueta}
      placeholder="–"
      title='Escribe "90", "2" (minutos), "1:30" o "45s"'
      onFocus={(e) => { setBorrador(formatoDescanso(valor)); e.currentTarget.select(); }}
      onChange={(e) => {
        const v = e.target.value;
        setBorrador(v);
        // elegir de la lista confirma al tiro (no hay que salir del campo)
        if (/^\d{2}:\d{2}$/.test(v) && DESCANSOS_COMUNES.some((d) => formatoDescanso(d) === v)) {
          const seg = leerDescanso(v);
          if (seg !== undefined && seg !== valor) onCambio(seg);
        }
      }}
      onBlur={confirmar}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLInputElement).blur(); } }}
      maxLength={12}
    />
  );
}

export default function SetTable(p: SetTableProps) {
  const clave = claveCombo(p.intensityTypes);
  // una combinación guardada que no está en la lista igual se muestra
  const opciones = COMBINACIONES.some((c) => claveCombo(c) === clave)
    ? COMBINACIONES
    : [...COMBINACIONES, p.intensityTypes];

  return (
    <div className="set-table-wrap">
      <div className="set-table" role="table" aria-label="Sets del ejercicio">
        <div className="set-row set-head" role="row">
          <span />
          <label className="set-head-cell">
            <span>Volumen</span>
            <select className="set-scale" value={p.volumeType}
              onChange={(e) => p.onScales({ volumeType: e.target.value as TipoVolumen })}>
              <option value="reps">REPS</option>
              <option value="tiempo">SEGUNDOS</option>
            </select>
          </label>
          <div className="set-head-cell">
            <span>Descanso</span>
            <span className="set-scale set-scale-fija">DESC</span>
          </div>
          <div className="set-head-cell">
            <span>Ejecución</span>
            <span className="set-scale set-scale-fija" title="Excéntrica-pausa-concéntrica, en segundos">TEMPO</span>
          </div>
          <label className="set-head-cell">
            <span>Intensidad</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <select className="set-scale" style={{ flex: 1 }} value={clave}
                onChange={(e) => p.onScales({ intensityTypes: e.target.value.split('+') as EscalaIntensidad[] })}>
                {opciones.map((c) => (
                  <option key={claveCombo(c)} value={claveCombo(c)}>{c.map((e) => NOMBRE_ESCALA[e]).join(' + ')}</option>
                ))}
              </select>
              {p.intensityTypes.includes('kg') && (
                <select className="set-scale" value={p.unit} aria-label="Unidad de carga"
                  onChange={(e) => p.onScales({ unit: e.target.value as 'kg' | 'lb' })}>
                  <option value="kg">KG</option>
                  <option value="lb">LB</option>
                </select>
              )}
            </div>
          </label>
          <span />
        </div>

        {p.sets.map((s, i) => {
          return (
            <div key={s.id} className="set-row" role="row">
              <label className={`set-pill${s.set_type !== 'efectiva' ? ' set-pill-otro' : ''}`} title={`${TIPO_LARGO[s.set_type]} — clic para cambiar el tipo`}>
                <span>{NOMBRE_TIPO[s.set_type]} {i + 1}</span>
                <span aria-hidden="true" className="set-pill-menu">⋮</span>
                <select value={s.set_type} aria-label={`Tipo del set ${i + 1}`}
                  onChange={(e) => p.onSet(i, { set_type: e.target.value as TipoSet })}>
                  {TIPOS_SET.map((t) => <option key={t} value={t}>{TIPO_LARGO[t]}</option>)}
                </select>
              </label>

              <input className="set-cell" value={s.reps} aria-label={`Volumen del set ${i + 1}`}
                onChange={(e) => p.onSet(i, { reps: e.target.value })}
                placeholder="–" maxLength={20} />

              <CeldaDescanso valor={s.rest_seconds} etiqueta={`Descanso del set ${i + 1}`}
                onCambio={(seg) => p.onSet(i, { rest_seconds: seg })} />

              <input className="set-cell set-tempo" value={s.tempo} aria-label={`Tempo del set ${i + 1}`}
                onChange={(e) => p.onSet(i, { tempo: e.target.value })}
                placeholder="-   -   -" maxLength={20} />

              {/* "RIR 2 - 80/85%": cada escala es texto + un input sin caja */}
              <div className="set-cell set-int">
                {p.intensityTypes.map((e, k) => {
                  const campo = campoDe(e);
                  const v = s[campo];
                  return (
                    <span key={e} className="set-int-parte">
                      {k > 0 && <span className="set-int-sep" aria-hidden="true">-</span>}
                      {(e === 'rir' || e === 'rpe') && <span>{NOMBRE_ESCALA[e]}</span>}
                      <input value={v} style={ancho(v)} aria-label={`${NOMBRE_ESCALA[e]} del set ${i + 1}`}
                        inputMode={e === 'kg' ? 'decimal' : undefined} placeholder="–" maxLength={20}
                        onChange={(ev) => p.onSet(i, { [campo]: ev.target.value } as Partial<EditSet>)} />
                      {e === 'pct_1rm' && <span>%</span>}
                      {e === 'kg' && <span>{p.unit}</span>}
                    </span>
                  );
                })}
              </div>

              <div className="set-acciones">
                <button type="button" className="set-icono" title="Duplicar set" aria-label={`Duplicar set ${i + 1}`}
                  onClick={() => p.onDuplicate(i)}><IconoCopiar /></button>
                <button type="button" className="set-icono" title="Quitar set" aria-label={`Quitar set ${i + 1}`}
                  disabled={p.sets.length <= 1} onClick={() => p.onRemove(i)}><IconoBasura /></button>
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" className="set-add" onClick={p.onAdd}>+ AÑADIR SET</button>
      <datalist id="descansos-comunes">
        {DESCANSOS_COMUNES.map((d) => <option key={d} value={formatoDescanso(d)} />)}
      </datalist>
    </div>
  );
}
