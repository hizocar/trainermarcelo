'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import { WEEK_DAYS_SHORT, formatShortDate } from '@/lib/weeks';

// La semana del alumno, viva y editable. Lo que pidió Marcelo: todo lo que el
// coach VE de la rutina se puede corregir aquí mismo (cada serie registrada, y
// también registrar las que faltan), y si el alumno está entrenando en este
// momento, los registros van apareciendo solos — la vista se refresca cada
// pocos segundos contra la misma consulta de tamaño fijo del calendario.
//
// El coach escribe con logged_by = su uid: la política logs_update/insert lo
// exige, y de paso queda la traza de que esa serie la corrigió el coach.

export interface DiaSemana {
  id: string;
  day_number: number;
  name: string;
  week_day: number | null;
  exercises: { id: string; name: string; unit: string; series: { id: string; num: number }[] }[];
}

export interface LogSerie {
  series_id: string;
  weight: number;
  reps: number;
  rir: number | null;
  logged_at: string | null;
}

const POLL_MS = 10_000;

export default function WeekLive({
  clientId, coachId, week, planWeekId, days, initialLogs, cardioMin, live,
}: {
  clientId: string;
  coachId: string;
  week: number;
  planWeekId: string;
  days: DiaSemana[];
  initialLogs: LogSerie[];
  cardioMin: number;
  live: boolean;
}) {
  const supabase = createClient();
  const [logs, setLogs] = useState<Map<string, LogSerie>>(
    () => new Map(initialLogs.map(l => [l.series_id, l])),
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [peso, setPeso] = useState('');
  const [reps, setReps] = useState('');
  const [rir, setRir] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const editingRef = useRef<string | null>(null);
  editingRef.current = editing;

  // refresco en vivo: solo la semana actual, solo con la pestaña visible,
  // y nunca mientras el coach está escribiendo en una serie.
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(async () => {
      if (document.visibilityState !== 'visible' || editingRef.current) return;
      const { data, error: err } = await supabase
        .from('workout_logs')
        .select('series_id, weight, reps, rir, logged_at, exercise_series!inner ( exercises!inner ( training_days!inner ( plan_week_id ) ) )')
        .eq('exercise_series.exercises.training_days.plan_week_id', planWeekId)
        .eq('week_number', week);
      if (err) return; // el próximo tick reintenta; el error de guardado sí se muestra
      setLogs(new Map((data ?? []).map((l: any) => [l.series_id, {
        series_id: l.series_id, weight: l.weight, reps: l.reps, rir: l.rir, logged_at: l.logged_at,
      }])));
      setLastSync(new Date());
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [live, planWeekId, week, supabase]);

  function abrir(serieId: string) {
    const log = logs.get(serieId);
    setEditing(serieId);
    setPeso(log ? String(log.weight) : '');
    setReps(log ? String(log.reps) : '');
    setRir(log?.rir != null ? String(log.rir) : '');
    setError(null);
  }

  async function guardar(serieId: string) {
    const w = parseFloat(peso.replace(',', '.'));
    const r = parseInt(reps, 10);
    const ri = rir.trim() === '' ? null : parseInt(rir, 10);
    if (!isFinite(w) || w < 0 || !isFinite(r) || r < 0) {
      setError('Peso y repeticiones deben ser números.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from('workout_logs')
      .upsert(
        { series_id: serieId, week_number: week, weight: w, reps: r, rir: ri, logged_by: coachId, logged_at: new Date().toISOString() },
        { onConflict: 'series_id,week_number' },
      );
    setBusy(false);
    if (err) { setError(err.message); return; }
    setLogs(prev => {
      const next = new Map(prev);
      next.set(serieId, { series_id: serieId, weight: w, reps: r, rir: ri, logged_at: new Date().toISOString() });
      return next;
    });
    setEditing(null);
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

  const inputStyle: React.CSSProperties = {
    width: 54, background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 6, color: 'var(--text)', padding: '4px 6px',
    fontFamily: 'var(--font-mono)', fontSize: 12, textAlign: 'center',
  };

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
        <p className="muted" style={{ fontSize: 11, marginTop: 10, fontFamily: 'var(--font-mono)', letterSpacing: 1 }}>
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

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {ex.series.map((s) => {
                    const log = logs.get(s.id);
                    if (editing === s.id) {
                      return (
                        <span key={s.id} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          background: 'var(--surface)', border: '1px solid var(--accent)',
                          borderRadius: 6, padding: '4px 8px',
                        }}>
                          <b style={{ fontSize: 10, color: 'var(--accent)' }}>S{s.num}</b>
                          <input style={inputStyle} value={peso} onChange={e => setPeso(e.target.value)}
                            inputMode="decimal" placeholder={ex.unit} autoFocus aria-label="Peso" />
                          <span className="muted" style={{ fontSize: 11 }}>×</span>
                          <input style={inputStyle} value={reps} onChange={e => setReps(e.target.value)}
                            inputMode="numeric" placeholder="reps" aria-label="Repeticiones" />
                          <input style={{ ...inputStyle, width: 44 }} value={rir} onChange={e => setRir(e.target.value)}
                            inputMode="numeric" placeholder="RIR" aria-label="RIR" />
                          <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 11 }}
                            onClick={() => guardar(s.id)} disabled={busy}>
                            {busy ? '…' : 'OK'}
                          </button>
                          <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }}
                            onClick={() => setEditing(null)} disabled={busy}>
                            ✕
                          </button>
                        </span>
                      );
                    }
                    return (
                      <button
                        key={s.id}
                        onClick={() => abrir(s.id)}
                        title={log ? 'Corregir esta serie' : 'Registrar esta serie'}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                          background: log ? 'var(--surface)' : 'transparent',
                          border: log ? '1px solid var(--border)' : '1px dashed var(--border)',
                          borderRadius: 6, padding: '3px 8px', color: 'inherit',
                        }}
                      >
                        <b style={{ fontSize: 10, color: log ? 'var(--accent)' : 'var(--text-muted)' }}>S{s.num}</b>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: log ? 'inherit' : 'var(--text-muted)' }}>
                          {log
                            ? `${log.weight}${ex.unit} × ${log.reps}${log.rir != null ? ` · RIR ${log.rir}` : ''}`
                            : '—'}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {error && editing && ex.series.some(s => s.id === editing) && (
                  <p style={{ fontSize: 12, color: 'var(--warning)', marginTop: 6 }}>{error}</p>
                )}
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
