'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import { WEEK_DAYS_SHORT, formatShortDate } from '@/lib/weeks';

// La semana del alumno, viva y editable — con la MISMA gramática de registro
// de la app (WorkoutLogScreen): filas S1/S2/S3 con PESO·REPS·RIR siempre a la
// vista, se guarda al salir del campo (nunca mientras se escribe: la lección
// del bug del "12" que se guardaba como "1"), y un ✓ marca la serie guardada.
//
// Si el alumno está entrenando en este momento, sus registros aparecen solos:
// refresco cada 10 s con la consulta de tamaño fijo del calendario, pausado
// mientras el coach tiene un campo en foco o la pestaña oculta.
//
// El coach escribe con logged_by = su uid: la política logs_update/insert lo
// exige, y de paso queda la traza de que esa serie la corrigió el coach.

export interface DiaSemana {
  id: string;
  day_number: number;
  name: string;
  week_day: number | null;
  exercises: {
    id: string; name: string; unit: string; ref_weight: number | null;
    series: { id: string; num: number }[];
  }[];
}

/** Último registro anterior a esta semana, por serie — para precargar. */
export type LogPrevio = { weight: number; reps: number; week: number };

export interface LogSerie {
  series_id: string;
  weight: number;
  reps: number;
  rir: number | null;
  logged_at: string | null;
}

const POLL_MS = 10_000;

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--surface, var(--card))', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--text)', padding: '9px 6px',
  fontFamily: 'var(--font-mono), monospace', fontSize: 14, textAlign: 'center',
};

// Una fila de serie, espejo de la app: sus valores viven locales mientras se
// escribe y se intenta guardar recién al salir del campo. La key del padre la
// remonta cuando el registro cambia desde afuera (el alumno, otro refresco).
function SerieFila({
  serie, log, previo, refWeight, week, coachId, alGuardar, alEnfocar, alDesenfocar,
}: {
  serie: { id: string; num: number };
  log: LogSerie | undefined;
  previo: LogPrevio | undefined;
  refWeight: number | null;
  week: number;
  coachId: string;
  alGuardar: (l: LogSerie) => void;
  alEnfocar: () => void;
  alDesenfocar: () => void;
}) {
  const supabase = createClient();
  // sin registro aún: el peso llega precargado con el de la última vez (o el
  // de referencia del plan), igual que la app; no se guarda nada hasta que
  // haya también repeticiones.
  const [peso, setPeso] = useState(
    log ? String(log.weight) : ((previo?.weight ?? refWeight)?.toString() ?? ''),
  );
  const [reps, setReps] = useState(log ? String(log.reps) : '');
  const [rir, setRir] = useState(log?.rir != null ? String(log.rir) : '');
  const [estado, setEstado] = useState<'vacia' | 'guardando' | 'ok' | 'error'>(log ? 'ok' : 'vacia');
  const [msg, setMsg] = useState<string | null>(null);

  async function guardarSiCorresponde() {
    const w = parseFloat(peso.replace(',', '.'));
    const r = parseInt(reps, 10);
    const ri = rir.trim() === '' ? null : parseInt(rir, 10);
    // incompleta: no se guarda nada todavía (igual que la app)
    if (!Number.isFinite(w) || w < 0 || !Number.isFinite(r) || r < 0) return;
    if (log && log.weight === w && log.reps === r && (log.rir ?? null) === ri) return;
    setEstado('guardando');
    setMsg(null);
    const { error } = await supabase.from('workout_logs').upsert(
      {
        series_id: serie.id, week_number: week, weight: w, reps: r,
        rir: Number.isFinite(ri as number) ? ri : null,
        logged_by: coachId, logged_at: new Date().toISOString(),
      },
      { onConflict: 'series_id,week_number' },
    );
    if (error) { setEstado('error'); setMsg(error.message); return; }
    setEstado('ok');
    alGuardar({
      series_id: serie.id, weight: w, reps: r,
      rir: Number.isFinite(ri as number) ? (ri as number) : null,
      logged_at: new Date().toISOString(),
    });
  }

  function blur() {
    alDesenfocar();
    guardarSiCorresponde();
  }

  return (
    <>
      <div style={{
        display: 'grid', gridTemplateColumns: '30px 84px 84px 64px 22px',
        gap: 8, alignItems: 'center', marginTop: 6,
      }}>
        <b style={{
          fontSize: 11, color: estado === 'ok' ? 'var(--accent)' : 'var(--text-muted)',
          fontFamily: 'var(--font-mono), monospace',
        }}>
          S{serie.num}
        </b>
        <input style={inputStyle} value={peso} onChange={e => setPeso(e.target.value)}
          onFocus={alEnfocar} onBlur={blur} inputMode="decimal" placeholder="—"
          aria-label={`Peso serie ${serie.num}`} />
        <input style={inputStyle} value={reps} onChange={e => setReps(e.target.value)}
          onFocus={alEnfocar} onBlur={blur} inputMode="numeric"
          placeholder={previo ? String(previo.reps) : '—'}
          title={previo ? `Semana ${previo.week}: ${previo.weight} × ${previo.reps}` : undefined}
          aria-label={`Repeticiones serie ${serie.num}`} />
        <input style={inputStyle} value={rir} onChange={e => setRir(e.target.value)}
          onFocus={alEnfocar} onBlur={blur} inputMode="numeric" placeholder="—"
          aria-label={`RIR serie ${serie.num}`} />
        <span aria-hidden style={{
          fontSize: 14,
          color: estado === 'ok' ? 'var(--accent)' : estado === 'error' ? 'var(--warning)' : 'var(--text-muted)',
        }}>
          {estado === 'ok' ? '✓' : estado === 'guardando' ? '…' : estado === 'error' ? '!' : ''}
        </span>
      </div>
      {msg && (
        <p style={{ fontSize: 12, color: 'var(--warning)', margin: '4px 0 0 38px' }}>
          No se pudo guardar: {msg}
        </p>
      )}
    </>
  );
}

export default function WeekLive({
  clientId, coachId, week, planWeekId, days, initialLogs, previos, cardioMin, live,
}: {
  clientId: string;
  coachId: string;
  week: number;
  planWeekId: string;
  days: DiaSemana[];
  initialLogs: LogSerie[];
  previos: Record<string, LogPrevio>;
  cardioMin: number;
  live: boolean;
}) {
  const supabase = useRef(createClient()).current;
  const [logs, setLogs] = useState<Map<string, LogSerie>>(
    () => new Map(initialLogs.map(l => [l.series_id, l])),
  );
  const [lastSync, setLastSync] = useState<Date | null>(null);
  // sube con cada refresco del servidor: remonta las filas con valores
  // frescos SOLO entonces (un guardado propio no remonta — no roba el foco)
  const [epoca, setEpoca] = useState(0);
  // cuántos campos están en foco ahora mismo: mientras haya uno, no se
  // refresca desde el servidor (no pisarle los dedos al coach)
  const enFoco = useRef(0);

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(async () => {
      if (document.visibilityState !== 'visible' || enFoco.current > 0) return;
      const { data, error } = await supabase
        .from('workout_logs')
        .select('series_id, weight, reps, rir, logged_at, exercise_series!inner ( exercises!inner ( training_days!inner ( plan_week_id ) ) )')
        .eq('exercise_series.exercises.training_days.plan_week_id', planWeekId)
        .eq('week_number', week);
      if (error) return; // el próximo tick reintenta; los errores de guardado sí se muestran
      setLogs(new Map((data ?? []).map((l: any) => [l.series_id, {
        series_id: l.series_id, weight: l.weight, reps: l.reps, rir: l.rir, logged_at: l.logged_at,
      }])));
      setLastSync(new Date());
      setEpoca(e => e + 1);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [live, planWeekId, week, supabase]);

  function registrar(l: LogSerie) {
    setLogs(prev => {
      const next = new Map(prev);
      next.set(l.series_id, l);
      return next;
    });
  }

  // agregados que se recalculan con cada registro nuevo
  const exConLog = new Set<string>();
  const fechaPorDia = new Map<string, string>();
  let volumen = 0;
  days.forEach(d => d.exercises.forEach(e => e.series.forEach(s => {
    const log = logs.get(s.id);
    if (!log) return;
    exConLog.add(e.id);
    volumen += log.weight * log.reps;
    const prev = fechaPorDia.get(d.id);
    if (log.logged_at && (!prev || log.logged_at < prev)) fechaPorDia.set(d.id, log.logged_at);
  })));
  const totalEjercicios = days.reduce((a, d) => a + d.exercises.length, 0);

  return (
    <>
      <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
        {[
          { v: `${exConLog.size}/${totalEjercicios}`, l: 'EJERCICIOS REGISTRADOS' },
          { v: Math.round(volumen).toLocaleString('es-CL'), l: 'KG TOTALES' },
          { v: String(cardioMin), l: 'MIN CARDIO' },
        ].map((s) => (
          <div key={s.l} className="editor-day" style={{ flex: 1, minWidth: 150, textAlign: 'center', padding: 16 }}>
            <div className="display" style={{ fontSize: 26, color: 'var(--accent)' }}>{s.v}</div>
            <div className="label muted" style={{ fontSize: 9, letterSpacing: 1 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {live && (
        <p className="muted" style={{ fontSize: 11, marginTop: 10, fontFamily: 'var(--font-mono), monospace', letterSpacing: 1 }}>
          ● EN VIVO — si tu alumno registra una serie ahora, aparece aquí sola
          {lastSync ? ` · actualizado ${lastSync.toLocaleTimeString('es-CL')}` : ''}
        </p>
      )}

      {days.map((day) => {
        const doneInDay = day.exercises.filter(e => e.series.some(s => logs.has(s.id))).length;
        const trained = doneInDay > 0;
        const trainedDate = fechaPorDia.get(day.id);
        return (
          <div key={day.id} className="editor-day" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              <span style={{
                background: trained ? 'var(--accent)' : 'var(--surface)',
                color: trained ? 'var(--bg)' : 'var(--text-secondary)',
                border: '1px solid var(--border)', borderRadius: 6,
                padding: '3px 8px', fontSize: 11, fontWeight: 800, letterSpacing: 1,
              }}>
                {day.week_day != null ? WEEK_DAYS_SHORT[day.week_day].toUpperCase() : `D${day.day_number}`}
              </span>
              <h3 style={{ fontSize: 15, margin: 0 }}>{day.name.toUpperCase()}</h3>
              <span className="muted" style={{ fontSize: 12, marginLeft: 'auto' }}>
                {trained
                  ? `${doneInDay}/${day.exercises.length} ejercicios${trainedDate ? ` · ${formatShortDate(trainedDate)}` : ''}`
                  : 'Sin registrar'}
              </span>
            </div>

            {day.exercises.map((ex) => (
              <div key={ex.id} style={{ borderTop: '1px solid var(--border)', padding: '10px 0' }}>
                <Link
                  href={`/clients/${clientId}/exercise/${ex.id}`}
                  style={{
                    fontSize: 13,
                    fontWeight: ex.series.some(s => logs.has(s.id)) ? 700 : 400,
                    color: ex.series.some(s => logs.has(s.id)) ? 'var(--text)' : 'var(--text-secondary)',
                    textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                  title={`Ver historial de ${ex.name}`}
                >
                  {ex.name}
                  <span className="muted" style={{ fontSize: 10 }}>›</span>
                </Link>

                {/* cabecera de columnas, como la tabla de la app */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '30px 84px 84px 64px 22px',
                  gap: 8, marginTop: 8,
                }}>
                  <span />
                  <span className="label muted" style={{ fontSize: 9, letterSpacing: 1.5, textAlign: 'center' }}>
                    PESO ({ex.unit.toUpperCase()})
                  </span>
                  <span className="label muted" style={{ fontSize: 9, letterSpacing: 1.5, textAlign: 'center' }}>REPS</span>
                  <span className="label muted" style={{ fontSize: 9, letterSpacing: 1.5, textAlign: 'center' }}>RIR</span>
                  <span />
                </div>
                {ex.series.map((s) => {
                  const log = logs.get(s.id);
                  return (
                    <SerieFila
                      /* remonta la fila solo cuando llegan datos del servidor */
                      key={`${s.id}:${epoca}`}
                      serie={s}
                      log={log}
                      previo={previos[s.id]}
                      refWeight={ex.ref_weight}
                      week={week}
                      coachId={coachId}
                      alGuardar={registrar}
                      alEnfocar={() => { enFoco.current += 1; }}
                      alDesenfocar={() => { enFoco.current = Math.max(0, enFoco.current - 1); }}
                    />
                  );
                })}
              </div>
            ))}
            {day.exercises.length === 0 && (
              <p className="muted" style={{ fontSize: 12 }}>Sin ejercicios en este día.</p>
            )}
          </div>
        );
      })}
    </>
  );
}
