'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import type { PlanDay } from '@/lib/types';

// Editor de un programa (plantilla sin cliente asignado). Es el mismo
// modelo de edición que PlanEditor, pero sobre program_template_* en vez
// de training_days/exercises — y sin 'archivar': un programa no tiene
// historial de nadie todavía, así que quitar algo acá lo borra de verdad.

const WEEKDAYS = ['—', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const WEEKDAY_VALUE = [null, 1, 2, 3, 4, 5, 6, 0];

const MUSCLE_GROUPS = [
  'Pecho', 'Espalda alta', 'Espalda baja',
  'Hombro anterior', 'Hombro medial', 'Hombro posterior',
  'Bíceps', 'Tríceps', 'Antebrazos',
  'Cuádriceps', 'Isquiotibiales', 'Aductor',
  'Glúteo mayor', 'Glúteo medio', 'Glúteo menor',
  'Gastrocnemios', 'Core',
];

let tmpCounter = 0;
const tmpId = () => `tmp_${Date.now()}_${tmpCounter++}`;
const isTmp = (id: string) => id.startsWith('tmp_');

interface LibItem {
  id: string;
  name: string;
  name_en: string | null;
  muscle_group: string | null;
  equipment: string | null;
}

interface EditSeries { id: string; series_number: number }
interface EditExercise {
  id: string;
  name: string;
  library_id: string | null;
  name_en: string | null;
  muscle_group: string;
  reps_objective: string;
  unit: 'kg' | 'lb';
  ref_weight: string;
  rest_seconds: string;
  target_rir: string;
  superseries_group: string;
  series: EditSeries[];
}

// Colores estables para biseries/triseries: mismo grupo → mismo color,
// tanto en la pizarra como en la app del cliente.
const GROUP_COLORS = ['#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#22c55e', '#ef4444'];
function groupColor(group: string) {
  let h = 0;
  for (let i = 0; i < group.length; i++) h = (h * 31 + group.charCodeAt(i)) >>> 0;
  return GROUP_COLORS[h % GROUP_COLORS.length];
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
      library_id: (e as any).library_id ?? null,
      name_en: e.name_en ?? null,
      muscle_group: e.muscle_group ?? '',
      reps_objective: e.reps_objective ?? '',
      unit: (e.unit as 'kg' | 'lb') ?? 'kg',
      ref_weight: e.ref_weight != null ? String(e.ref_weight) : '',
      rest_seconds: e.rest_seconds != null ? String(e.rest_seconds) : '',
      target_rir: e.target_rir ?? '',
      superseries_group: (e as any).superseries_group ?? '',
      series: (e.exercise_series ?? []).map((s) => ({ id: s.id, series_number: s.series_number })),
    })),
  }));
}

function LibrarySearch({
  onPick, onCreate,
}: { onPick: (item: LibItem) => void; onCreate: (query: string) => void }) {
  const supabase = createClient();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<LibItem[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onChange(v: string) {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    const query = v.trim();
    if (query.length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('exercise_library')
        .select('id, name, name_en, muscle_group, equipment')
        .or(`name.ilike.%${query}%,name_en.ilike.%${query}%`)
        .limit(6);
      setResults((data ?? []) as LibItem[]);
    }, 220);
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="ex-input"
        value={q}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar en la biblioteca…"
        autoFocus
      />
      {q.trim().length >= 2 && (
        <div className="lib-dropdown">
          {results.map((r) => (
            <button key={r.id} type="button" className="lib-item" onClick={() => onPick(r)}>
              <span>{r.name}</span>
              <small>{r.muscle_group}{r.equipment ? ` · ${r.equipment}` : ''}</small>
            </button>
          ))}
          <button type="button" className="lib-item lib-create" onClick={() => onCreate(q.trim())}>
            + Agregar “{q.trim()}” a la biblioteca
          </button>
        </div>
      )}
    </div>
  );
}

export default function TemplateEditor({ templateId, initialDays }: { templateId: string; initialDays: PlanDay[] }) {
  const supabase = createClient();
  const [days, setDays] = useState<EditDay[]>(() => toEditModel(initialDays));
  const [delDays, setDelDays] = useState<string[]>([]);
  const [delEx, setDelEx] = useState<string[]>([]);
  const [delSeries, setDelSeries] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);

  const [libForm, setLibForm] = useState<{ di: number; ei: number; name: string; nameEn: string; muscle: string; equipment: string } | null>(null);
  const [libSaving, setLibSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      // Sugerencia: el próximo día de semana libre (Lun..Dom) para que el
      // split quede distribuido automáticamente en vez de partir sin fecha.
      const used = new Set(d.map((x) => x.week_day).filter((v) => v != null));
      const order = [1, 2, 3, 4, 5, 6, 0];
      const suggested = order.find((v) => !used.has(v)) ?? null;
      d.push({ id: tmpId(), name: 'Nuevo día', week_day: suggested, exercises: [] });
      return d;
    });
  }
  function removeDay(di: number) {
    const day = days[di];
    if (day.exercises.length > 0 &&
        !window.confirm(`¿Quitar "${day.name}" del programa?`)) return;
    if (!isTmp(day.id)) setDelDays((x) => [...x, day.id]);
    mutate((d) => { d.splice(di, 1); return d; });
  }

  function addExercise(di: number) {
    mutate((d) => {
      d[di].exercises.push({
        id: tmpId(), name: '', library_id: null, name_en: null, muscle_group: '',
        reps_objective: '', unit: 'kg', ref_weight: '', rest_seconds: '', target_rir: '', superseries_group: '',
        series: [{ id: tmpId(), series_number: 1 }, { id: tmpId(), series_number: 2 }, { id: tmpId(), series_number: 3 }],
      });
      return d;
    });
  }
  function removeExercise(di: number, ei: number) {
    const ex = days[di].exercises[ei];
    if (!isTmp(ex.id) && !window.confirm(`¿Quitar "${ex.name}" del programa?`)) return;
    if (!isTmp(ex.id)) setDelEx((x) => [...x, ex.id]);
    mutate((d) => { d[di].exercises.splice(ei, 1); return d; });
  }

  function moveExercise(di: number, ei: number, dir: -1 | 1) {
    const j = ei + dir;
    if (j < 0 || j >= days[di].exercises.length) return;
    mutate((d) => {
      const list = d[di].exercises;
      [list[ei], list[j]] = [list[j], list[ei]];
      return d;
    });
  }

  function changeSeries(di: number, ei: number, delta: number) {
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

  function pickFromLibrary(di: number, ei: number, item: LibItem) {
    updateEx(di, ei, {
      name: item.name,
      library_id: item.id,
      name_en: item.name_en,
      muscle_group: item.muscle_group ?? '',
    });
  }

  async function createInLibrary() {
    if (!libForm) return;
    if (!libForm.name.trim()) return;
    if (!libForm.muscle) { setError('Elige el grupo muscular del nuevo ejercicio.'); return; }
    setLibSaving(true);
    setError(null);
    const { data, error: insErr } = await supabase
      .from('exercise_library')
      .insert({
        name: libForm.name.trim(),
        name_en: libForm.nameEn.trim() || null,
        muscle_group: libForm.muscle,
        equipment: libForm.equipment.trim() || null,
        coach_id: uid,
      })
      .select('id, name, name_en, muscle_group, equipment')
      .single();
    setLibSaving(false);
    if (insErr) { setError(`No se pudo agregar a la biblioteca: ${insErr.message}`); return; }
    pickFromLibrary(libForm.di, libForm.ei, data as LibItem);
    setLibForm(null);
  }

  async function save() {
    const unpicked = days.flatMap((d, i) =>
      d.exercises.some((e) => isTmp(e.id) && !e.library_id) ? [`Día ${i + 1}`] : [],
    );
    if (unpicked.length > 0) {
      setError(`Hay ejercicios sin elegir de la biblioteca en: ${unpicked.join(', ')}. Selecciónalos o quítalos antes de guardar.`);
      return;
    }
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      if (delSeries.length) {
        const { error } = await supabase.from('program_template_series').delete().in('id', delSeries);
        if (error) throw error;
      }
      if (delEx.length) {
        const { error } = await supabase.from('program_template_exercises').delete().in('id', delEx);
        if (error) throw error;
      }
      if (delDays.length) {
        const { error } = await supabase.from('program_template_days').delete().in('id', delDays);
        if (error) throw error;
      }

      for (let di = 0; di < days.length; di++) {
        const day = days[di];
        const dayNumber = di + 1;
        let dayId = day.id;

        if (isTmp(dayId)) {
          const { data, error } = await supabase
            .from('program_template_days')
            .insert({ template_id: templateId, day_number: dayNumber, name: day.name, week_day: day.week_day })
            .select('id')
            .single();
          if (error) throw error;
          dayId = data.id;
        } else {
          const { error } = await supabase
            .from('program_template_days')
            .update({ day_number: dayNumber, name: day.name, week_day: day.week_day })
            .eq('id', dayId);
          if (error) throw error;
        }

        for (let ei = 0; ei < day.exercises.length; ei++) {
          const ex = day.exercises[ei];
          const refNum = Number(ex.ref_weight.replace(',', '.'));
          const restNum = parseInt(ex.rest_seconds, 10);
          const fields = {
            muscle_group: ex.muscle_group.trim() || null,
            reps_objective: ex.reps_objective.trim(),
            unit: ex.unit,
            ref_weight: ex.ref_weight.trim() === '' || isNaN(refNum) ? null : refNum,
            rest_seconds: isNaN(restNum) ? null : restNum,
            target_rir: ex.target_rir.trim() || null,
            superseries_group: ex.superseries_group.trim() || null,
            order_index: ei,
          };
          let exId = ex.id;
          if (isTmp(exId)) {
            const { data, error } = await supabase
              .from('program_template_exercises')
              .insert({
                day_id: dayId,
                name: ex.name,
                name_en: ex.name_en,
                library_id: ex.library_id,
                ...fields,
              })
              .select('id')
              .single();
            if (error) throw error;
            exId = data.id;
          } else {
            const { error } = await supabase.from('program_template_exercises').update(fields).eq('id', exId);
            if (error) throw error;
          }

          for (let si = 0; si < ex.series.length; si++) {
            const s = ex.series[si];
            if (isTmp(s.id)) {
              const { error } = await supabase
                .from('program_template_series')
                .insert({ exercise_id: exId, series_number: si + 1 });
              if (error) throw error;
            } else {
              const { error } = await supabase
                .from('program_template_series')
                .update({ series_number: si + 1 })
                .eq('id', s.id);
              if (error) throw error;
            }
          }
        }
      }

      setDelDays([]); setDelEx([]); setDelSeries([]);
      setDirty(false);
      setMsg('Cambios guardados ✓');
    } catch (e: any) {
      setError(e?.message ?? 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      {days.length > 0 && (
        <div className="editor-day" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 22px 4px' }}>
            <h3 style={{ marginBottom: 4 }}>Pizarra semanal</h3>
            <p className="muted" style={{ fontSize: 13 }}>
              Todo el split de un vistazo. Reordena o quita ejercicios acá; para editar reps,
              peso, descanso o RIR usa la tabla de cada día más abajo.
            </p>
          </div>
          <div className="board-scroll">
            {days.map((day, di) => (
              <div key={day.id} className="board-col">
                <div className="board-col-head">
                  {day.week_day != null && (
                    <span className="board-col-weekday">{WEEKDAYS[WEEKDAY_VALUE.indexOf(day.week_day)] ?? ''}</span>
                  )}
                  <span className="board-col-name">{day.name || `Día ${di + 1}`}</span>
                  <span className="board-col-meta">{day.exercises.length} ejercicios</span>
                </div>
                {day.exercises.length === 0 ? (
                  <span className="board-empty">Sin ejercicios</span>
                ) : (
                  day.exercises.map((ex, ei) => (
                    <div
                      key={ex.id}
                      className="board-ex"
                      style={ex.superseries_group.trim() ? { borderLeft: `3px solid ${groupColor(ex.superseries_group.trim())}` } : undefined}
                    >
                      <span className="board-ex-name">
                        {ex.superseries_group.trim() && <span title={`Biserie ${ex.superseries_group}`}>🔗 </span>}
                        {ex.name || '(sin nombre)'}
                      </span>
                      <div className="board-ex-actions">
                        <button className="icon-btn" style={{ width: 24, height: 24, fontSize: 11 }}
                          onClick={() => moveExercise(di, ei, -1)} disabled={ei === 0}>↑</button>
                        <button className="icon-btn" style={{ width: 24, height: 24, fontSize: 11 }}
                          onClick={() => moveExercise(di, ei, 1)} disabled={ei === day.exercises.length - 1}>↓</button>
                        <button className="icon-btn" style={{ width: 24, height: 24, fontSize: 11 }}
                          onClick={() => removeExercise(di, ei)}>✕</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
            <button className="icon-btn" title="Quitar día" onClick={() => removeDay(di)} style={{ marginLeft: 'auto' }}>✕</button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="ex-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 220 }}>Ejercicio</th>
                  <th style={{ minWidth: 120 }}>Músculo</th>
                  <th>Series</th>
                  <th style={{ minWidth: 90 }}>Reps</th>
                  <th>Ref</th>
                  <th>Unidad</th>
                  <th>Descanso</th>
                  <th>RIR</th>
                  <th style={{ minWidth: 110 }}>Biserie</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {day.exercises.map((ex, ei) => (
                  <tr key={ex.id}>
                    <td>
                      {ex.library_id || !isTmp(ex.id) ? (
                        <div className="ex-name-locked" title="El nombre identifica el historial una vez asignado a un cliente.">
                          <span>{ex.name}</span>
                          <span className="lock">🔒</span>
                        </div>
                      ) : (
                        <LibrarySearch
                          onPick={(item) => pickFromLibrary(di, ei, item)}
                          onCreate={(query) => setLibForm({ di, ei, name: query, nameEn: '', muscle: '', equipment: '' })}
                        />
                      )}
                    </td>
                    <td>
                      <input className="ex-input" value={ex.muscle_group}
                        onChange={(e) => updateEx(di, ei, { muscle_group: e.target.value })} placeholder="Grupo" />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => changeSeries(di, ei, -1)}>−</button>
                        <strong className="ex-mono" style={{ minWidth: 16, textAlign: 'center' }}>{ex.series.length}</strong>
                        <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => changeSeries(di, ei, 1)}>+</button>
                      </div>
                    </td>
                    <td>
                      <input className="ex-input ex-input-mono" value={ex.reps_objective}
                        onChange={(e) => updateEx(di, ei, { reps_objective: e.target.value })} placeholder="10-12" />
                    </td>
                    <td>
                      <input className="ex-input ex-input-mono narrow" value={ex.ref_weight}
                        onChange={(e) => updateEx(di, ei, { ref_weight: e.target.value })} placeholder="0" inputMode="decimal" />
                    </td>
                    <td>
                      <select className="ex-input ex-input-mono narrow" value={ex.unit}
                        onChange={(e) => updateEx(di, ei, { unit: e.target.value as 'kg' | 'lb' })}>
                        <option value="kg">kg</option>
                        <option value="lb">lb</option>
                      </select>
                    </td>
                    <td>
                      <input className="ex-input ex-input-mono narrow" value={ex.rest_seconds}
                        onChange={(e) => updateEx(di, ei, { rest_seconds: e.target.value })} placeholder="seg" inputMode="numeric" />
                    </td>
                    <td>
                      <input className="ex-input ex-input-mono narrow" value={ex.target_rir}
                        onChange={(e) => updateEx(di, ei, { target_rir: e.target.value })} placeholder="2-3" />
                    </td>
                    <td>
                      <input
                        className="ex-input"
                        value={ex.superseries_group}
                        onChange={(e) => updateEx(di, ei, { superseries_group: e.target.value })}
                        placeholder="ej: A"
                        title="Ejercicios con el mismo texto acá quedan encadenados como biserie/triserie y se ven agrupados y coloreados para el cliente."
                        style={ex.superseries_group.trim() ? { borderLeft: `3px solid ${groupColor(ex.superseries_group.trim())}` } : undefined}
                      />
                    </td>
                    <td>
                      <button className="icon-btn" title="Quitar del programa" onClick={() => removeExercise(di, ei)}>✕</button>
                    </td>
                  </tr>
                ))}
                {day.exercises.length === 0 && (
                  <tr><td colSpan={10} className="muted" style={{ padding: 14 }}>Sin ejercicios en este día.</td></tr>
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

      {libForm && (
        <div className="modal-overlay" onClick={() => setLibForm(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 4 }}>Nuevo en la biblioteca</h3>
            <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
              Quedará disponible para todos tus planes y clientes.
            </p>
            <div className="field">
              <label>Nombre</label>
              <input className="input" value={libForm.name}
                onChange={(e) => setLibForm({ ...libForm, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Nombre en inglés (opcional)</label>
              <input className="input" value={libForm.nameEn}
                onChange={(e) => setLibForm({ ...libForm, nameEn: e.target.value })} />
            </div>
            <div className="field">
              <label>Grupo muscular</label>
              <select className="input" value={libForm.muscle}
                onChange={(e) => setLibForm({ ...libForm, muscle: e.target.value })}>
                <option value="">Elegir…</option>
                {MUSCLE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Equipo (opcional)</label>
              <input className="input" value={libForm.equipment}
                onChange={(e) => setLibForm({ ...libForm, equipment: e.target.value })}
                placeholder="barra, mancuerna, máquina…" />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" style={{ padding: '10px 16px' }} onClick={() => setLibForm(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ padding: '10px 16px' }} onClick={createInLibrary} disabled={libSaving}>
                {libSaving ? 'Agregando…' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}

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
