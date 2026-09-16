'use client';

import {
  ESCALAS, TIPOS_SET, partirDescanso, unirDescanso,
  type EscalaIntensidad, type TipoSet, type TipoVolumen,
} from '@/lib/objetivoSerie';

// La tabla de sets del ejercicio (modelo que pidieron Yharel y Marcelo):
// cada fila es un set con su volumen, descanso, tempo e intensidad. Las
// ESCALAS se eligen una vez en el encabezado (qué mide el volumen; una o
// dos escalas de intensidad, p. ej. RIR + %1RM) y cada fila lleva solo
// valores. Agregar un set copia el último: casi siempre se cambia uno solo.

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

const NOMBRE_ESCALA: Record<EscalaIntensidad, string> = { rir: 'RIR', rpe: 'RPE', pct_1rm: '% 1RM', kg: 'CARGA' };
const NOMBRE_TIPO: Record<TipoSet, string> = { efectiva: 'SET', calentamiento: 'CALENT.', drop: 'DROP', fallo: 'FALLO' };
const TIPO_LARGO: Record<TipoSet, string> = { efectiva: 'Set efectivo', calentamiento: 'Calentamiento', drop: 'Drop set', fallo: 'Al fallo' };

const campoDe = (e: EscalaIntensidad): keyof EditSet =>
  e === 'rir' ? 'rir' : e === 'rpe' ? 'rpe' : e === 'pct_1rm' ? 'pct_1rm' : 'peso';

export default function SetTable(p: SetTableProps) {
  const [a, b] = p.intensityTypes;

  return (
    <div className="set-table-wrap">
      <div className="set-table" role="table" aria-label="Sets del ejercicio">
        <div className="set-row set-head" role="row">
          <span />
          <label className="set-head-cell">
            <span title="Reps (ej. 12-15) o segundos (ej. 45)">Volumen</span>
            <select className="set-scale" value={p.volumeType}
              onChange={(e) => p.onScales({ volumeType: e.target.value as TipoVolumen })}>
              <option value="reps">REPS</option>
              <option value="tiempo">TIEMPO (s)</option>
            </select>
          </label>
          <div className="set-head-cell">
            <span>Descanso</span>
            <span className="set-scale set-scale-fija">MIN : SEG</span>
          </div>
          <div className="set-head-cell">
            <span>Ejecución</span>
            <span className="set-scale set-scale-fija">TEMPO</span>
          </div>
          <div className="set-head-cell">
            <span title="Ej.: RIR 2 · RPE 8 · %1RM 80/85 · carga 60">Intensidad</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <select className="set-scale" value={a} aria-label="Escala de intensidad"
                onChange={(e) => {
                  const nueva = e.target.value as EscalaIntensidad;
                  p.onScales({ intensityTypes: b && b !== nueva ? [nueva, b] : [nueva] });
                }}>
                {ESCALAS.map((e) => <option key={e} value={e}>{NOMBRE_ESCALA[e]}</option>)}
              </select>
              <select className="set-scale" value={b ?? ''} aria-label="Segunda escala (opcional)"
                onChange={(e) => {
                  const v = e.target.value as EscalaIntensidad | '';
                  p.onScales({ intensityTypes: v ? [a, v] : [a] });
                }}>
                <option value="">+ ESCALA</option>
                {ESCALAS.filter((e) => e !== a).map((e) => <option key={e} value={e}>{NOMBRE_ESCALA[e]}</option>)}
              </select>
              {p.intensityTypes.includes('kg') && (
                <select className="set-scale" value={p.unit} aria-label="Unidad de carga"
                  onChange={(e) => p.onScales({ unit: e.target.value as 'kg' | 'lb' })}>
                  <option value="kg">KG</option>
                  <option value="lb">LB</option>
                </select>
              )}
            </div>
          </div>
          <span />
        </div>

        {p.sets.map((s, i) => {
          const desc = partirDescanso(s.rest_seconds);
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

              <div className="set-cell set-desc">
                <input value={desc.min} aria-label={`Minutos de descanso del set ${i + 1}`} inputMode="numeric" placeholder="–"
                  onChange={(e) => p.onSet(i, { rest_seconds: unirDescanso(e.target.value, desc.seg) })} />
                <span aria-hidden="true">:</span>
                <input value={desc.seg} aria-label={`Segundos de descanso del set ${i + 1}`} inputMode="numeric" placeholder="–"
                  onChange={(e) => p.onSet(i, { rest_seconds: unirDescanso(desc.min, e.target.value) })} />
              </div>

              <input className="set-cell" value={s.tempo} aria-label={`Tempo del set ${i + 1}`}
                onChange={(e) => p.onSet(i, { tempo: e.target.value })}
                placeholder="– – – –" maxLength={20} title="Excéntrica-pausa-concéntrica-pausa, en segundos" />

              <div className="set-cell set-int">
                {p.intensityTypes.map((e) => (
                  <label key={e} className="set-int-campo">
                    <span>{e === 'kg' ? p.unit.toUpperCase() : e === 'pct_1rm' ? '%' : NOMBRE_ESCALA[e]}</span>
                    <input value={s[campoDe(e)] as string} aria-label={`${NOMBRE_ESCALA[e]} del set ${i + 1}`}
                      inputMode={e === 'kg' ? 'decimal' : undefined}
                      onChange={(ev) => p.onSet(i, { [campoDe(e)]: ev.target.value } as Partial<EditSet>)}
                      placeholder="–" maxLength={20} />
                  </label>
                ))}
              </div>

              <div className="set-acciones">
                <button type="button" className="icon-btn" title="Duplicar set" aria-label={`Duplicar set ${i + 1}`}
                  onClick={() => p.onDuplicate(i)}>⧉</button>
                <button type="button" className="icon-btn" title="Quitar set" aria-label={`Quitar set ${i + 1}`}
                  disabled={p.sets.length <= 1} onClick={() => p.onRemove(i)}>✕</button>
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" className="set-add" onClick={p.onAdd}>+ AÑADIR SET</button>
    </div>
  );
}
