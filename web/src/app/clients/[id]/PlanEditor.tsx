'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import type { PlanDay } from '@/lib/types';

const WEEKDAYS = ['—', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
// índice del array → week_day real (0=Dom … 6=Sáb); '—' = null
const WEEKDAY_VALUE = [null, 1, 2, 3, 4, 5, 6, 0];

let tmpCounter = 0;
const tmpId = () => `tmp_${Date.now()}_${tmpCounter++}`;
const isTmp = (id: string) => id.startsWith('tmp_');

interface EditSeries { id: string; series_number: number }
interface EditExercise {
  id: string;
  name: string;
  muscle_group: string;
  reps_objective: string;
  unit: 'kg' | 'lb';
  ref_weight: string;
  rest_seconds: string;
  target_rir: string;
  series: EditSeries[];
}
interface EditDay {
  id: string;
  name: string;
  week_day: number | null;
  exercises: EditExercise[];
}

function toEditModel(days: PlanDay[]): EditDay[] {
  return days.map((d) => ({
    id: d.id,
    name: d.name,
    week_day: d.week_day ?? null,
    exercises: (d.exercises ?? []).map((e) => ({
      id: e.id,
      name: e.name ?? '',
      muscle_group: e.muscle_group ?? '',
      reps_objective: e.reps_objective ?? '',
      unit: (e.unit as 'kg' | 'lb') ?? 'kg',
      ref_weight: e.ref_weight != null ? String(e.ref_weight) : '',
      rest_seconds: e.rest_seconds != null ? String(e.rest_seconds) : '',
      target_rir: e.target_rir ?? '',
      series: (e.exercise_series ?? []).map((s) => ({ id: s.id, series_number: s.series_number })),
    })),
  }));
}

export default function PlanEditor({ planId, initialDays }: { planId: string; initialDays: PlanDay[] }) {
  const supabase = createClient();
  const [days, setDays] = useState<EditDay[]>(() => toEditModel(initialDays));
  const [delDays, setDelDays] = useState<string[]>([]);
  const [delEx, setDelEx] = useState<string[]>([]);
  const [delSeries, setDelSeries] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function mutate(fn: (draft: EditDay[]) => EditDay[]) {
    setDays((prev) => fn(structuredClone(prev)));
    setDirty(true);
    setMsg(null);
  }

  function updateDay(di: number, patch: Partial<EditDay>) {
    mutate((d) => { d[di] = { ...d[di], ...patch }; return d; });
  }
  function updateEx(di: number, ei: number, patch: Partial<EditExercise>) {
    mutate((d) => { d[di].exercises[ei] = { ...d[di].exercises[ei], ...patch }; return d; });
  }

  function addDay() {
    mutate((d) => {
      d.push({ id: tmpId(), name: 'Nuevo día', week_day: null, exercises: [] });
      return d;
    });
  }
  function removeDay(di: number) {
    const day = days[di];
    if (day.exercises.length > 0 &&
        !window.confirm(`¿Eliminar "${day.name}" y sus ${day.exercises.length} ejercicios?`)) return;
    if (!isTmp(day.id)) {
      setDelDays((x) => [...x, day.id]);
      setDelEx((x) => [...x, ...day.exercises.filter((e) => !isTmp(e.id)).map((e) => e.id)]);
    }
    mutate((d) => { d.splice(di, 1); return d; });
  }

  function addExercise(di: number) {
    mutate((d) => {
      d[di].exercises.push({
        id: tmpId(), name: '', muscle_group: '', reps_objective: '', unit: 'kg',
        ref_weight: '', rest_seconds: '', target_rir: '',
        series: [{ id: tmpId(), series_number: 1 }, { id: tmpId(), series_number: 2 }, { id: tmpId(), series_number: 3 }],
      });
      return d;
    });
  }
  function removeExercise(di: number, ei: number) {
    const ex = days[di].exercises[ei];
    if (!isTmp(ex.id) && ex.name &&
        !window.confirm(`¿Eliminar "${ex.name}"?`)) return;
    if (!isTmp(ex.id)) setDelEx((x) => [...x, ex.id]);
    mutate((d) => { d[di].exercises.splice(ei, 1); return d; });
  }

  function changeSeries(di: number, ei: number, delta: number) {
    // el marcado para borrar va FUERA del updater: React puede re-ejecutarlo (StrictMode)
    if (delta < 0) {
      const list = days[di].exercises[ei].series;
      if (list.length <= 1) return;
      const removed = list[list.length - 1];
      if (!isTmp(removed.id)) setDelSeries((x) => [...x, removed.id]);
    }
    mutate((d) => {
      const list = d[di].exercises[ei].series;
      if (delta > 0) list.push({ id: tmpId(), series_number: list.length + 1 });
      else if (list.length > 1) list.pop();
      return d;
    });
  }

  async function save() {
    const unnamed = days.flatMap((d, i) =>
      d.exercises.some((e) => !e.name.trim()) ? [`Día ${i + 1}`] : [],
    );
    if (unnamed.length > 0) {
      setError(`Hay ejercicios sin nombre en: ${unnamed.join(', ')}. Ponles nombre o elimínalos antes de guardar.`);
      return;
    }
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      // 1) borrar series marcadas
      if (delSeries.length) {
        const { error } = await supabase.from('exercise_series').delete().in('id', delSeries);
        if (error) throw error;
      }
      // 2) borrar ejercicios marcados (y sus series)
      if (delEx.length) {
        const { error: eSer } = await supabase.from('exercise_series').delete().in('exercise_id', delEx);
        if (eSer) throw eSer;
        const { error } = await supabase.from('exercises').delete().in('id', delEx);
        if (error) throw error;
      }
      // 3) borrar días marcados
      if (delDays.length) {
        const { error } = await supabase.from('training_days').delete().in('id', delDays);
        if (error) throw error;
      }

      // 4) recorrer días en orden y persistir
      for (let di = 0; di < days.length; di++) {
        const day = days[di];
        const dayNumber = di + 1;
        let dayId = day.id;

        if (isTmp(dayId)) {
          const { data, error } = await supabase
            .from('training_days')
            .insert({ plan_id: planId, day_number: dayNumber, name: day.name, week_day: day.week_day })
            .select('id')
            .single();
          if (error) throw error;
          dayId = data.id;
        } else {
          const { error } = await supabase
            .from('training_days')
            .update({ day_number: dayNumber, name: day.name, week_day: day.week_day })
            .eq('id', dayId);
          if (error) throw error;
        }

        for (let ei = 0; ei < day.exercises.length; ei++) {
          const ex = day.exercises[ei];
          const refNum = Number(ex.ref_weight.replace(',', '.'));
          const restNum = parseInt(ex.rest_seconds, 10);
          const fields = {
            name: ex.name.trim(),
            muscle_group: ex.muscle_group.trim() || null,
            reps_objective: ex.reps_objective.trim(),
            unit: ex.unit,
            ref_weight: ex.ref_weight.trim() === '' || isNaN(refNum) ? null : refNum,
            rest_seconds: isNaN(restNum) ? null : restNum,
            target_rir: ex.target_rir.trim() || null,
            order_index: ei,
          };
          let exId = ex.id;
          if (isTmp(exId)) {
            const { data, error } = await supabase
              .from('exercises')
              .insert({ day_id: dayId, ...fields })
              .select('id')
              .single();
            if (error) throw error;
            exId = data.id;
          } else {
            const { error } = await supabase.from('exercises').update(fields).eq('id', exId);
            if (error) throw error;
          }

          // series nuevas de este ejercicio
          for (let si = 0; si < ex.series.length; si++) {
            const s = ex.series[si];
            if (isTmp(s.id)) {
              const { error } = await supabase
                .from('exercise_series')
                .insert({ exercise_id: exId, series_number: si + 1 });
              if (error) throw error;
            } else {
              // asegurar numeración correcta tras cambios
              const { error } = await supabase
                .from('exercise_series')
                .update({ series_number: si + 1 })
                .eq('id', s.id);
              if (error) throw error;
            }
          }
        }
      }

      setDelDays([]); setDelEx([]); setDelSeries([]);
      setDirty(false);
      setMsg('Cambios guardados ✓ — ya se ven en la app del cliente.');
    } catch (e: any) {
      // 23503 = violación de foreign key: la serie/ejercicio ya tiene entrenamientos registrados
      setError(
        e?.code === '23503'
          ? 'No se pudo eliminar: el cliente ya registró entrenamientos en esas series. Recarga la página para restaurar el plan.'
          : e?.message ?? 'No se pudieron guardar los cambios.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      {days.map((day, di) => (
        <div key={day.id} className="editor-day">
          <div className="editor-day-head">
            <div className="day-badge">D{di + 1}</div>
            <input
              className="ex-input"
              style={{ maxWidth: 320, fontWeight: 700 }}
              value={day.name}
              onChange={(e) => updateDay(di, { name: e.target.value })}
              placeholder="Nombre del día (ej: Torso 1)"
            />
            <select
              className="ex-input"
              style={{ width: 90 }}
              value={WEEKDAY_VALUE.findIndex((v) => v === day.week_day)}
              onChange={(e) => updateDay(di, { week_day: WEEKDAY_VALUE[Number(e.target.value)] })}
            >
              {WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}</option>)}
            </select>
            <button className="icon-btn" title="Eliminar día" onClick={() => removeDay(di)} style={{ marginLeft: 'auto' }}>✕</button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="ex-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 180 }}>Ejercicio</th>
                  <th style={{ minWidth: 120 }}>Músculo</th>
                  <th>Series</th>
                  <th style={{ minWidth: 90 }}>Reps</th>
                  <th>Ref</th>
                  <th>Unidad</th>
                  <th>Descanso</th>
                  <th>RIR</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {day.exercises.map((ex, ei) => (
                  <tr key={ex.id}>
                    <td>
                      <input className="ex-input" value={ex.name}
                        onChange={(e) => updateEx(di, ei, { name: e.target.value })} placeholder="Nombre" />
                    </td>
                    <td>
                      <input className="ex-input" value={ex.muscle_group}
                        onChange={(e) => updateEx(di, ei, { muscle_group: e.target.value })} placeholder="Grupo" />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => changeSeries(di, ei, -1)}>−</button>
                        <strong style={{ minWidth: 16, textAlign: 'center' }}>{ex.series.length}</strong>
                        <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => changeSeries(di, ei, 1)}>+</button>
                      </div>
                    </td>
                    <td>
                      <input className="ex-input" value={ex.reps_objective}
                        onChange={(e) => updateEx(di, ei, { reps_objective: e.target.value })} placeholder="10-12" />
                    </td>
                    <td>
                      <input className="ex-input narrow" value={ex.ref_weight}
                        onChange={(e) => updateEx(di, ei, { ref_weight: e.target.value })} placeholder="0" inputMode="decimal" />
                    </td>
                    <td>
                      <select className="ex-input narrow" value={ex.unit}
                        onChange={(e) => updateEx(di, ei, { unit: e.target.value as 'kg' | 'lb' })}>
                        <option value="kg">kg</option>
                        <option value="lb">lb</option>
                      </select>
                    </td>
                    <td>
                      <input className="ex-input narrow" value={ex.rest_seconds}
                        onChange={(e) => updateEx(di, ei, { rest_seconds: e.target.value })} placeholder="seg" inputMode="numeric" />
                    </td>
                    <td>
                      <input className="ex-input narrow" value={ex.target_rir}
                        onChange={(e) => updateEx(di, ei, { target_rir: e.target.value })} placeholder="2-3" />
                    </td>
                    <td>
                      <button className="icon-btn" title="Eliminar ejercicio" onClick={() => removeExercise(di, ei)}>✕</button>
                    </td>
                  </tr>
                ))}
                {day.exercises.length === 0 && (
                  <tr><td colSpan={9} className="muted" style={{ padding: 14 }}>Sin ejercicios en este día.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <button className="btn btn-ghost" style={{ marginTop: 14, padding: '10px 16px' }} onClick={() => addExercise(di)}>
            + Agregar ejercicio
          </button>
        </div>
      ))}

      <button className="btn btn-ghost" style={{ marginTop: 18 }} onClick={addDay}>+ Agregar día</button>

      <div className="save-bar">
        {error && <span style={{ color: 'var(--danger)', fontSize: 13, marginRight: 'auto' }}>{error}</span>}
        {msg && <span className="toast" style={{ marginRight: 'auto' }}>{msg}</span>}
        {dirty && !error && !msg && <span className="muted" style={{ marginRight: 'auto', fontSize: 13 }}>Cambios sin guardar</span>}
        <button className="btn btn-primary" onClick={save} disabled={saving || !dirty}>
          {saving ? 'GUARDANDO…' : 'GUARDAR CAMBIOS'}
        </button>
      </div>
    </div>
  );
}
