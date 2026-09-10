'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

// Las semanas del programa (v39): explícitas, como las de un plan. El número
// de semanas ES la duración del programa — al asignarlo, la semana N cae en
// la semana actual+N-1 del alumno y la última se repite hacia adelante.

export interface TplWeek {
  id: string;
  week_number: number;
  name: string;
}

export default function TemplateWeekManager({
  templateId, weeks, selectedWeekId,
}: { templateId: string; weeks: TplWeek[]; selectedWeekId: string | null }) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const creando = useRef(false);

  // un programa recién creado no tiene semanas: se crea la Semana 1 sola
  // (mismo comportamiento que WeekManagerScreen en la app con los planes)
  useEffect(() => {
    if (weeks.length > 0 || creando.current) return;
    creando.current = true;
    supabase.from('program_template_weeks')
      .insert({ template_id: templateId, week_number: 1, name: 'Semana 1' })
      .then(({ error: err }) => {
        if (err) setError(err.message);
        else router.refresh();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks.length]);

  function irA(weekId: string) {
    router.push(`/programs/${templateId}?week=${weekId}`);
  }

  async function crearSemana(duplicar: boolean) {
    setBusy(true);
    setError(null);
    try {
      const nextNumber = weeks.length > 0 ? Math.max(...weeks.map(w => w.week_number)) + 1 : 1;
      const { data: nueva, error: weekErr } = await supabase
        .from('program_template_weeks')
        .insert({ template_id: templateId, week_number: nextNumber, name: `Semana ${nextNumber}` })
        .select('id')
        .single();
      if (weekErr || !nueva) throw weekErr ?? new Error('No se pudo crear la semana.');

      if (duplicar && selectedWeekId) {
        const { data: dias, error: diasErr } = await supabase
          .from('program_template_days')
          .select(`
            day_number, name, week_day,
            program_template_exercises ( name, name_en, library_id, muscle_group, superseries_group,
              reps_objective, unit, ref_weight, order_index, rest_seconds, target_rir, tempo, notes, video_url,
              program_template_series ( series_number ) )
          `)
          .eq('template_week_id', selectedWeekId);
        if (diasErr) throw diasErr;

        for (const dia of (dias ?? [])) {
          const { program_template_exercises: ejercicios, ...campos } = dia as any;
          const { data: nuevoDia, error: diaErr } = await supabase
            .from('program_template_days')
            .insert({ ...campos, template_id: templateId, template_week_id: nueva.id })
            .select('id')
            .single();
          if (diaErr || !nuevoDia) throw diaErr ?? new Error('No se pudo copiar un día.');
          for (const ex of (ejercicios ?? [])) {
            const { program_template_series: series, ...camposEx } = ex as any;
            const { data: nuevoEx, error: exErr } = await supabase
              .from('program_template_exercises')
              .insert({ ...camposEx, day_id: nuevoDia.id })
              .select('id')
              .single();
            if (exErr || !nuevoEx) throw exErr ?? new Error('No se pudo copiar un ejercicio.');
            const filas = (series ?? []).map((s: any) => ({ exercise_id: nuevoEx.id, series_number: s.series_number }));
            if (filas.length > 0) {
              const { error: serErr } = await supabase.from('program_template_series').insert(filas);
              if (serErr) throw serErr;
            }
          }
        }
      }
      router.refresh();
      irA(nueva.id);
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo crear la semana.');
    } finally {
      setBusy(false);
    }
  }

  async function renombrar() {
    const actual = weeks.find(w => w.id === selectedWeekId);
    if (!actual) return;
    const nombre = window.prompt('Nombre de la semana', actual.name);
    if (!nombre || nombre.trim() === '' || nombre.trim() === actual.name) return;
    const { error: err } = await supabase
      .from('program_template_weeks').update({ name: nombre.trim().slice(0, 60) }).eq('id', actual.id);
    if (err) { setError(err.message); return; }
    router.refresh();
  }

  async function quitar() {
    const actual = weeks.find(w => w.id === selectedWeekId);
    if (!actual || weeks.length <= 1) return;
    if (!window.confirm(`¿Quitar "${actual.name}" del programa? Sus días se borran (un programa no tiene historial de nadie).`)) return;
    setBusy(true);
    setError(null);
    try {
      const { data: dias, error: dErr } = await supabase
        .from('program_template_days').select('id, program_template_exercises ( id )')
        .eq('template_week_id', actual.id);
      if (dErr) throw dErr;
      const exIds = (dias ?? []).flatMap((d: any) => (d.program_template_exercises ?? []).map((e: any) => e.id));
      if (exIds.length > 0) {
        const { error: sErr } = await supabase.from('program_template_series').delete().in('exercise_id', exIds);
        if (sErr) throw sErr;
        const { error: eErr } = await supabase.from('program_template_exercises').delete().in('id', exIds);
        if (eErr) throw eErr;
      }
      const { error: ddErr } = await supabase.from('program_template_days').delete().eq('template_week_id', actual.id);
      if (ddErr) throw ddErr;
      const { error: wErr } = await supabase.from('program_template_weeks').delete().eq('id', actual.id);
      if (wErr) throw wErr;
      router.refresh();
      const resto = weeks.filter(w => w.id !== actual.id);
      if (resto[0]) irA(resto[0].id);
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo quitar la semana.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 18 }}>
      <span className="label muted" style={{ letterSpacing: 2 }}>
        Semanas del programa · {weeks.length || 1}
      </span>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {weeks.map((w, i) => {
          const activa = w.id === selectedWeekId;
          return (
            <button
              key={w.id}
              className="btn btn-ghost"
              onClick={() => irA(w.id)}
              style={{
                padding: '8px 14px',
                ...(activa ? { background: 'var(--accent)', color: 'var(--on-accent)', borderColor: 'var(--accent)' } : {}),
              }}
            >
              S{i + 1} · {w.name}
            </button>
          );
        })}
        <button className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: 12 }} onClick={() => crearSemana(false)} disabled={busy}>
          + SEMANA
        </button>
        <button className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: 12 }} onClick={() => crearSemana(true)} disabled={busy || !selectedWeekId}>
          DUPLICAR ESTA
        </button>
        <button className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: 12 }} onClick={renombrar} disabled={busy || !selectedWeekId}>
          RENOMBRAR
        </button>
        {weeks.length > 1 && (
          <button className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: 12 }} onClick={quitar} disabled={busy}>
            QUITAR
          </button>
        )}
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
        Al asignarlo, la Semana 1 cae en la semana actual del alumno, la 2 en la siguiente, y la última se repite hacia adelante.
      </p>
      {error && <p style={{ fontSize: 13, color: 'var(--warning)', marginTop: 6 }}>{error}</p>}
    </div>
  );
}
