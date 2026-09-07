'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import type { PlanWeek } from '@/lib/planWeeks';

// Panel de "Gestión de semanas": cada semana es un split 100% independiente
// (sus propios días/ejercicios/series). Antes había un solo split que se
// repetía para siempre sin poder cerrarse ni duplicarse — ver
// trainer-app/supabase_migration_v17.sql para el porqué del cambio.

export default function WeekManager({
  planId, weeks, selectedWeekId, clientId,
}: { planId: string; weeks: PlanWeek[]; selectedWeekId: string | null; clientId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  function goTo(weekId: string) {
    router.push(`/clients/${clientId}?weekId=${weekId}`);
  }

  async function createWeek() {
    setBusy(true);
    setError(null);
    const nextNumber = weeks.length > 0 ? Math.max(...weeks.map(w => w.week_number)) + 1 : 1;
    const { data, error: err } = await supabase
      .from('plan_weeks')
      .insert({ plan_id: planId, week_number: nextNumber, name: `Semana ${weeks.length + 1}` })
      .select('id')
      .single();
    setBusy(false);
    if (err || !data) { setError(err?.message ?? 'No se pudo crear la semana.'); return; }
    router.refresh();
    goTo(data.id);
  }

  async function duplicateWeek(source: PlanWeek) {
    setBusy(true);
    setError(null);
    try {
      const nextNumber = Math.max(...weeks.map(w => w.week_number)) + 1;
      const { data: newWeek, error: weekErr } = await supabase
        .from('plan_weeks')
        .insert({ plan_id: planId, week_number: nextNumber, name: `${source.name} (copia)`, is_deload: source.is_deload })
        .select('id')
        .single();
      if (weekErr || !newWeek) throw weekErr ?? new Error('No se pudo crear la semana.');

      const { data: sourceDays, error: daysErr } = await supabase
        .from('training_days')
        .select(`
          day_number, name, week_day,
          exercises ( name, name_en, library_id, muscle_group, superseries_group,
            reps_objective, unit, ref_weight, order_index, rest_seconds, target_rir, tempo, notes,
            exercise_series ( series_number ) )
        `)
        .eq('plan_week_id', source.id).eq('archived', false);
      if (daysErr) throw daysErr;

      for (const day of (sourceDays ?? [])) {
        const { exercises, ...dayFields } = day as any;
        const { data: newDay, error: dayErr } = await supabase
          .from('training_days')
          .insert({ ...dayFields, plan_id: planId, plan_week_id: newWeek.id })
          .select('id')
          .single();
        if (dayErr || !newDay) throw dayErr ?? new Error('No se pudo copiar un día.');

        for (const ex of (exercises ?? [])) {
          const { exercise_series, ...exFields } = ex;
          const { data: newEx, error: exErr } = await supabase
            .from('exercises')
            .insert({ ...exFields, day_id: newDay.id })
            .select('id')
            .single();
          if (exErr || !newEx) throw exErr ?? new Error('No se pudo copiar un ejercicio.');
          if ((exercise_series ?? []).length > 0) {
            await supabase.from('exercise_series').insert(
              exercise_series.map((s: any) => ({ exercise_id: newEx.id, series_number: s.series_number })),
            );
          }
        }
      }

      router.refresh();
      goTo(newWeek.id);
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo duplicar la semana.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteWeek(week: PlanWeek) {
    if (weeks.length <= 1) {
      setError('No puedes borrar la única semana del plan — crea o duplica otra primero.');
      return;
    }
    if (!window.confirm(`¿Eliminar "${week.name}"? El historial ya registrado del cliente se conserva.`)) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from('plan_weeks').update({ archived: true }).eq('id', week.id);
    setBusy(false);
    if (err) { setError(err.message); return; }
    if (week.id === selectedWeekId) {
      const remaining = weeks.filter(w => w.id !== week.id);
      router.push(`/clients/${clientId}${remaining.length ? `?weekId=${remaining[remaining.length - 1].id}` : ''}`);
    }
    router.refresh();
  }

  async function move(week: PlanWeek, dir: -1 | 1) {
    const sorted = [...weeks].sort((a, b) => a.week_number - b.week_number);
    const idx = sorted.findIndex(w => w.id === week.id);
    const j = idx + dir;
    if (j < 0 || j >= sorted.length) return;
    const other = sorted[j];
    setBusy(true);
    setError(null);
    // swap seguro: unique(plan_id, week_number) exige pasar por un valor
    // provisional para no chocar a mitad de camino
    const { error: e1 } = await supabase.from('plan_weeks').update({ week_number: -1 }).eq('id', week.id);
    const { error: e2 } = !e1 ? await supabase.from('plan_weeks').update({ week_number: week.week_number }).eq('id', other.id) : { error: e1 };
    const { error: e3 } = !e2 ? await supabase.from('plan_weeks').update({ week_number: other.week_number }).eq('id', week.id) : { error: e2 };
    setBusy(false);
    if (e3) { setError(e3.message); return; }
    router.refresh();
  }

  async function toggleDeload(week: PlanWeek) {
    setBusy(true);
    await supabase.from('plan_weeks').update({ is_deload: !week.is_deload }).eq('id', week.id);
    setBusy(false);
    router.refresh();
  }

  async function commitRename(week: PlanWeek) {
    const trimmed = renameValue.trim();
    setRenaming(null);
    if (!trimmed || trimmed === week.name) return;
    await supabase.from('plan_weeks').update({ name: trimmed }).eq('id', week.id);
    router.refresh();
  }

  const sorted = [...weeks].sort((a, b) => a.week_number - b.week_number);

  return (
    <div className="week-manager" style={{ marginTop: 20, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: 15 }}>GESTIÓN DE SEMANAS</h3>
        <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 12 }} onClick={createWeek} disabled={busy}>
          + NUEVA SEMANA
        </button>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 2, marginBottom: 10 }}>
        Cada semana es un split independiente. Si no planificas la siguiente, el cliente ve &quot;sin plan&quot; en vez de repetir la anterior sola — salvo que actives &quot;repetir&quot;.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {sorted.map((w, i) => {
          const active = w.id === selectedWeekId;
          return (
            <div
              key={w.id}
              className="week-chip"
              style={{
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                background: active ? 'var(--accent)' : 'var(--surface)',
                color: active ? 'var(--bg)' : 'var(--text)',
                borderRadius: 10, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150,
              }}
            >
              {renaming === w.id ? (
                <input
                  className="input"
                  style={{ fontSize: 12, padding: '4px 6px' }}
                  value={renameValue}
                  autoFocus
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(w)}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => goTo(w.id)}
                  style={{ background: 'transparent', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
                >
                  S{w.week_number} · {w.name}{w.is_deload ? ' · DELOAD' : ''}{w.repeat_forever ? ' · ∞' : ''}
                </button>
              )}
              <div style={{ display: 'flex', gap: 4, fontSize: 10 }}>
                <button className="icon-btn" style={{ width: 22, height: 22, fontSize: 10 }} title="Subir" onClick={() => move(w, -1)} disabled={busy || i === 0}>↑</button>
                <button className="icon-btn" style={{ width: 22, height: 22, fontSize: 10 }} title="Bajar" onClick={() => move(w, 1)} disabled={busy || i === sorted.length - 1}>↓</button>
                <button className="icon-btn" style={{ width: 22, height: 22, fontSize: 10 }} title="Renombrar" onClick={() => { setRenaming(w.id); setRenameValue(w.name); }} disabled={busy}>✎</button>
                <button className="icon-btn" style={{ width: 22, height: 22, fontSize: 10 }} title="Duplicar" onClick={() => duplicateWeek(w)} disabled={busy}>⧉</button>
                <button className="icon-btn" style={{ width: 22, height: 22, fontSize: 10 }} title={w.is_deload ? 'Quitar deload' : 'Marcar deload'} onClick={() => toggleDeload(w)} disabled={busy}>▽</button>
                <button className="icon-btn" style={{ width: 22, height: 22, fontSize: 10, color: 'var(--danger)' }} title="Eliminar" onClick={() => deleteWeek(w)} disabled={busy}>✕</button>
              </div>
            </div>
          );
        })}
      </div>

      {error && <div className="form-error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}
