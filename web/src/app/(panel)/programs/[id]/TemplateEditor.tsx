'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import LibrarySearch, { type LibItem } from '@/components/LibrarySearch';
import ExerciseVideoCell from '@/components/ExerciseVideoCell';
import { resolverVideo, type VideoLib } from '@/lib/videoBiblioteca';
import MiniBody from '@/components/MiniBody';
import type { PlanDay } from '@/lib/types';

// Editor de un programa como GRAN CALENDARIO (pedido de Marcelo): todas las
// semanas apiladas hacia abajo, cada una con sus 7 columnas Lun..Dom. El día
// de la semana YA NO se elige con un selector — es la celda donde vive el
// bloque: crear un día en la celda del jueves lo deja en jueves, y arrastrar
// el bloque a otra celda (de cualquier semana) lo reubica ahí.
//
// Las semanas (crear/duplicar/renombrar/quitar) van directo a la base; los
// días/ejercicios/series se guardan en lote con GUARDAR CAMBIOS, como
// siempre. Un programa no tiene historial de nadie: quitar borra de verdad.

const MUSCLE_GROUPS = [
  'Pecho', 'Espalda alta', 'Espalda baja',
  'Hombro anterior', 'Hombro medial', 'Hombro posterior',
  'Bíceps', 'Tríceps', 'Antebrazos',
  'Cuádriceps', 'Isquiotibiales', 'Aductor',
  'Glúteo mayor', 'Glúteo medio', 'Glúteo menor',
  'Gastrocnemios', 'Core',
];

// columnas del calendario (lunes primero) → week_day en numeración JS (0=Dom)
const COLUMNAS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
const WEEKDAY_DE_COLUMNA = [1, 2, 3, 4, 5, 6, 0];
const columnaDeWeekDay = (wd: number | null) => (wd == null ? 0 : (wd + 6) % 7);

let tmpCounter = 0;
const tmpId = () => `tmp_${Date.now()}_${tmpCounter++}`;
const isTmp = (id: string) => id.startsWith('tmp_');

// Tipos MIME propios: soltar fuera de un destino válido no escribe nada.
const DRAG_MIME = 'application/x-elitefit-ex';
const DRAG_MIME_DIA = 'application/x-elitefit-dia';

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
  video_url: string | null;
  series: EditSeries[];
}

const GROUP_COLORS = ['#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#22c55e', '#ef4444'];
function groupColor(group: string) {
  let h = 0;
  for (let i = 0; i < group.length; i++) h = (h * 31 + group.charCodeAt(i)) >>> 0;
  return GROUP_COLORS[h % GROUP_COLORS.length];
}

export interface TplWeekLite { id: string; name: string }

interface EditDay {
  id: string;
  weekId: string;
  name: string;
  week_day: number | null;
  exercises: EditExercise[];
}

function toEditModel(days: PlanDay[]): EditDay[] {
  return days.map((d) => ({
    id: d.id,
    weekId: (d as any).template_week_id ?? '',
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
      superseries_group: e.superseries_group ?? '',
      video_url: (e as any).video_url ?? null,
      series: (e.exercise_series ?? []).map((s) => ({ id: s.id, series_number: s.series_number })),
    })),
  }));
}

export default function TemplateEditor({ templateId, weeks, initialDays }: {
  templateId: string;
  weeks: TplWeekLite[];
  initialDays: PlanDay[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [semanas, setSemanas] = useState<TplWeekLite[]>(weeks);
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
  const [editCard, setEditCard] = useState<{ di: number; ei: number } | null>(null);

  // arrastre de ejercicios (tarjeta completa) y de días (bloque completo)
  const [drag, setDrag] = useState<{ di: number; ei: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ di: number; ei: number } | null>(null);
  const [dragDia, setDragDia] = useState<number | null>(null);
  const [sobreCelda, setSobreCelda] = useState<string | null>(null); // `${weekId}:${col}`
  const [sobreDiaEj, setSobreDiaEj] = useState<number | null>(null);
  const handleRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [announcement, setAnnouncement] = useState('');
  const recienArrastro = useRef(false);
  const creandoSemana1 = useRef(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // un programa recién creado no tiene semanas: nace la Semana 1 sola
  useEffect(() => {
    if (semanas.length > 0 || creandoSemana1.current) return;
    creandoSemana1.current = true;
    supabase.from('program_template_weeks')
      .insert({ template_id: templateId, week_number: 1, name: 'Semana 1' })
      .select('id, name')
      .single()
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else if (data) setSemanas([{ id: data.id, name: data.name }]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semanas.length]);

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

  // ── días: nacen EN una celda; moverlos es cambiar de celda ──
  function addDay(weekId: string, weekDayJs: number) {
    mutate((d) => {
      d.push({ id: tmpId(), weekId, name: 'Nuevo día', week_day: weekDayJs, exercises: [] });
      return d;
    });
  }
  function moverDiaACelda(di: number, weekId: string, weekDayJs: number) {
    const dia = days[di];
    if (!dia || (dia.weekId === weekId && dia.week_day === weekDayJs)) return;
    updateDay(di, { weekId, week_day: weekDayJs });
    setAnnouncement(`${dia.name || 'Día'} movido a ${COLUMNAS[columnaDeWeekDay(weekDayJs)]}`);
  }
  function removeDay(di: number) {
    const day = days[di];
    if (day.exercises.length > 0 &&
        !window.confirm(`¿Quitar "${day.name}" del programa?`)) return;
    if (!isTmp(day.id)) setDelDays((x) => [...x, day.id]);
    mutate((d) => { d.splice(di, 1); return d; });
  }
  function duplicarDia(di: number) {
    mutate((d) => {
      const src = d[di];
      d.push({
        id: tmpId(), weekId: src.weekId, name: `${src.name} (copia)`, week_day: src.week_day,
        exercises: src.exercises.map((e) => ({
          ...e, id: tmpId(),
          series: e.series.map((_, i) => ({ id: tmpId(), series_number: i + 1 })),
        })),
      });
      return d;
    });
  }

  function addExercise(di: number) {
    mutate((d) => {
      d[di].exercises.push({
        id: tmpId(), name: '', library_id: null, name_en: null, muscle_group: '',
        reps_objective: '', unit: 'kg', ref_weight: '', rest_seconds: '', target_rir: '', superseries_group: '',
        video_url: null,
        series: [{ id: tmpId(), series_number: 1 }, { id: tmpId(), series_number: 2 }, { id: tmpId(), series_number: 3 }],
      });
      return d;
    });
    setEditCard({ di, ei: days[di].exercises.length });
  }
  function removeExercise(di: number, ei: number) {
    const ex = days[di].exercises[ei];
    if (!isTmp(ex.id) && !window.confirm(`¿Quitar "${ex.name}" del programa?`)) return;
    if (!isTmp(ex.id)) setDelEx((x) => [...x, ex.id]);
    mutate((d) => { d[di].exercises.splice(ei, 1); return d; });
    setEditCard(null);
  }

  function reorderExercise(di: number, from: number, to: number) {
    const list = days[di].exercises;
    if (from === to || to < 0 || to >= list.length) return;
    mutate((d) => {
      const l = d[di].exercises;
      const [moved] = l.splice(from, 1);
      l.splice(to, 0, moved);
      return d;
    });
    setAnnouncement(`${list[from].name || 'Ejercicio'}, posición ${to + 1} de ${list.length}`);
  }

  function duplicarEjercicio(di: number, ei: number) {
    mutate((d) => {
      const e = d[di].exercises[ei];
      d[di].exercises.splice(ei + 1, 0, {
        ...e, id: tmpId(),
        series: e.series.map((_, i) => ({ id: tmpId(), series_number: i + 1 })),
      });
      return d;
    });
  }

  function moverEjercicioEntreDias(fromDi: number, fromEi: number, toDi: number, toEi: number) {
    const nombre = days[fromDi]?.exercises[fromEi]?.name || 'Ejercicio';
    mutate((d) => {
      const [ex] = d[fromDi].exercises.splice(fromEi, 1);
      d[toDi].exercises.splice(Math.min(toEi, d[toDi].exercises.length), 0, ex);
      return d;
    });
    setAnnouncement(`${nombre} movido a ${days[toDi]?.name ?? 'otro día'}`);
  }

  function reemplazarEjercicio(di: number, ei: number) {
    const ex = days[di].exercises[ei];
    if (!isTmp(ex.id)) setDelEx((x) => [...x, ex.id]);
    mutate((d) => {
      const e = d[di].exercises[ei];
      d[di].exercises[ei] = {
        ...e, id: tmpId(), name: '', library_id: null, name_en: null,
        series: e.series.map((_, i) => ({ id: tmpId(), series_number: i + 1 })),
      };
      return d;
    });
  }

  // ── semanas: directo a la base ──
  function bloquearPorCambios(): boolean {
    if (dirty) {
      setError('Guarda los cambios (botón de abajo) antes de duplicar o quitar semanas.');
      return true;
    }
    return false;
  }

  async function crearSemana() {
    setError(null);
    const { data, error: err } = await supabase
      .from('program_template_weeks')
      .insert({ template_id: templateId, week_number: semanas.length + 1, name: `Semana ${semanas.length + 1}` })
      .select('id, name')
      .single();
    if (err || !data) { setError(err?.message ?? 'No se pudo crear la semana.'); return; }
    setSemanas((s) => [...s, { id: data.id, name: data.name }]);
  }

  async function renombrarSemana(weekId: string, nombre: string) {
    const limpio = nombre.trim().slice(0, 60);
    if (!limpio) return;
    const { error: err } = await supabase
      .from('program_template_weeks').update({ name: limpio }).eq('id', weekId);
    if (err) { setError(err.message); return; }
    setSemanas((s) => s.map((w) => (w.id === weekId ? { ...w, name: limpio } : w)));
  }

  async function duplicarSemana(weekId: string) {
    if (bloquearPorCambios()) return;
    setError(null);
    try {
      const { data: nueva, error: weekErr } = await supabase
        .from('program_template_weeks')
        .insert({ template_id: templateId, week_number: semanas.length + 1, name: `${semanas.find(w => w.id === weekId)?.name ?? 'Semana'} (copia)`.slice(0, 60) })
        .select('id')
        .single();
      if (weekErr || !nueva) throw weekErr ?? new Error('No se pudo crear la semana.');
      const { data: dias, error: diasErr } = await supabase
        .from('program_template_days')
        .select(`
          day_number, name, week_day,
          program_template_exercises ( name, name_en, library_id, muscle_group, superseries_group,
            reps_objective, unit, ref_weight, order_index, rest_seconds, target_rir, tempo, notes, video_url,
            program_template_series ( series_number ) )
        `)
        .eq('template_week_id', weekId);
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
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo duplicar la semana.');
    }
  }

  async function quitarSemana(weekId: string) {
    if (semanas.length <= 1) return;
    if (bloquearPorCambios()) return;
    const nombre = semanas.find(w => w.id === weekId)?.name ?? 'esta semana';
    if (!window.confirm(`¿Quitar "${nombre}" del programa? Sus días se borran (un programa no tiene historial de nadie).`)) return;
    setError(null);
    try {
      const { data: dias, error: dErr } = await supabase
        .from('program_template_days').select('id, program_template_exercises ( id )')
        .eq('template_week_id', weekId);
      if (dErr) throw dErr;
      const exIds = (dias ?? []).flatMap((d: any) => (d.program_template_exercises ?? []).map((e: any) => e.id));
      if (exIds.length > 0) {
        const { error: sErr } = await supabase.from('program_template_series').delete().in('exercise_id', exIds);
        if (sErr) throw sErr;
        const { error: eErr } = await supabase.from('program_template_exercises').delete().in('id', exIds);
        if (eErr) throw eErr;
      }
      const { error: ddErr } = await supabase.from('program_template_days').delete().eq('template_week_id', weekId);
      if (ddErr) throw ddErr;
      const { error: wErr } = await supabase.from('program_template_weeks').delete().eq('id', weekId);
      if (wErr) throw wErr;
      setSemanas((s) => s.filter((w) => w.id !== weekId));
      setDays((d) => d.filter((x) => x.weekId !== weekId));
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo quitar la semana.');
    }
  }

  // ── arrastres ──
  function onHandleDragStart(di: number, ei: number, e: React.DragEvent<HTMLElement>) {
    recienArrastro.current = true;
    setDrag({ di, ei });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(DRAG_MIME, String(ei));
    const row = e.currentTarget.closest('.board-card');
    if (row) e.dataTransfer.setDragImage(row, 12, 12);
  }
  function endDrag() {
    setDrag(null);
    setDropTarget(null);
    setSobreDiaEj(null);
    setSobreCelda(null);
    setDragDia(null);
    setTimeout(() => { recienArrastro.current = false; }, 0);
  }

  function onRowDragOver(di: number, ei: number, e: React.DragEvent<HTMLElement>) {
    if (!drag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropTarget?.di !== di || dropTarget?.ei !== ei) setDropTarget({ di, ei });
  }
  function onRowDragLeave(di: number, ei: number, e: React.DragEvent<HTMLElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDropTarget((cur) => (cur?.di === di && cur.ei === ei ? null : cur));
  }
  function onRowDrop(di: number, ei: number, e: React.DragEvent<HTMLElement>) {
    if (!drag) return;
    e.preventDefault();
    e.stopPropagation();
    const raw = e.dataTransfer.getData(DRAG_MIME);
    const from = raw === '' ? drag.ei : Number(raw);
    if (Number.isInteger(from)) {
      if (drag.di === di) reorderExercise(di, from, ei);
      else moverEjercicioEntreDias(drag.di, from, di, ei);
    }
    endDrag();
  }
  function onHandleKeyDown(di: number, ei: number, e: React.KeyboardEvent) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const list = days[di].exercises;
    const to = ei + (e.key === 'ArrowUp' ? -1 : 1);
    if (to < 0 || to >= list.length) return;
    const movedId = list[ei].id;
    reorderExercise(di, ei, to);
    requestAnimationFrame(() => handleRefs.current[movedId]?.focus());
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

  async function pickFromLibrary(di: number, ei: number, item: LibItem) {
    updateEx(di, ei, {
      name: item.name,
      library_id: item.id,
      name_en: item.name_en,
      muscle_group: item.muscle_group ?? '',
    });
    const { data } = await supabase
      .from('library_videos')
      .select('library_id, coach_id, video_url, is_public')
      .eq('library_id', item.id);
    const url = resolverVideo((data ?? []) as VideoLib[], item.id, uid);
    if (url) updateEx(di, ei, { video_url: url });
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
    const unpicked = days.flatMap((d) =>
      d.exercises.some((e) => isTmp(e.id) && !e.library_id) ? [d.name || 'un día'] : [],
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

      // día a día, semana por semana: day_number = orden por columna (Lun..Dom)
      for (const semana of semanas) {
        const delWeek = days
          .map((d, di) => ({ d, di }))
          .filter(({ d }) => d.weekId === semana.id)
          .sort((a, b) => columnaDeWeekDay(a.d.week_day) - columnaDeWeekDay(b.d.week_day));

        for (let n = 0; n < delWeek.length; n++) {
          const day = delWeek[n].d;
          const dayNumber = n + 1;
          let dayId = day.id;

          if (isTmp(dayId)) {
            const { data, error } = await supabase
              .from('program_template_days')
              .insert({ template_id: templateId, template_week_id: day.weekId, day_number: dayNumber, name: day.name, week_day: day.week_day })
              .select('id')
              .single();
            if (error) throw error;
            dayId = data.id;
          } else {
            const { error } = await supabase
              .from('program_template_days')
              .update({ template_week_id: day.weekId, day_number: dayNumber, name: day.name, week_day: day.week_day })
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
              video_url: ex.video_url,
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
              const { error } = await supabase.from('program_template_exercises').update({ ...fields, day_id: dayId }).eq('id', exId);
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

  // ── tarjeta de un día (bloque) dentro de su celda ──
  function tarjetaDia(day: EditDay, di: number) {
    return (
      <div
        key={day.id}
        className="cal-dia"
        onDragOver={(e) => {
          if (drag && drag.di !== di) { e.preventDefault(); setSobreDiaEj(di); }
        }}
        onDragLeave={(e) => {
          if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) {
            setSobreDiaEj((s) => (s === di ? null : s));
          }
        }}
        onDrop={(e) => {
          if (!drag || drag.di === di) return;
          e.preventDefault();
          e.stopPropagation();
          moverEjercicioEntreDias(drag.di, drag.ei, di, day.exercises.length);
          endDrag();
        }}
        style={sobreDiaEj === di && drag && drag.di !== di
          ? { boxShadow: 'inset 0 0 0 2px var(--accent)' }
          : undefined}
      >
        <div className="board-day-banner" style={{ padding: '6px 8px' }}>
          <button
            type="button"
            className="board-day-drag"
            draggable
            onDragStart={(e) => {
              recienArrastro.current = true;
              setDragDia(di);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData(DRAG_MIME_DIA, String(di));
              const bloque = e.currentTarget.closest('.cal-dia');
              if (bloque) e.dataTransfer.setDragImage(bloque, 12, 12);
            }}
            onDragEnd={endDrag}
            title="Arrastra el día a otra celda del calendario (otro día u otra semana)"
            aria-label={`Mover el día ${day.name}`}
          >
            ⠿
          </button>
          <input
            className="board-day-name"
            style={{ fontSize: 13 }}
            value={day.name}
            onChange={(e) => updateDay(di, { name: e.target.value })}
            placeholder="Nombre del día"
          />
          <button className="board-day-x" title="Duplicar día (con sus ejercicios)" onClick={() => duplicarDia(di)}>⧉</button>
          <button className="board-day-x" title="Quitar día" onClick={() => removeDay(di)}>✕</button>
        </div>

        {day.exercises.map((ex, ei) => (
          <div
            key={ex.id}
            className={[
              'board-card', 'board-card-v2', 'cal-card',
              drag?.di === di && drag.ei === ei ? 'row-dragging' : '',
              dropTarget?.di === di && dropTarget.ei === ei && drag && (drag.di !== di || drag.ei !== ei)
                ? ((drag.di !== di || drag.ei > ei) ? 'row-drop-above' : 'row-drop-below')
                : '',
            ].filter(Boolean).join(' ')}
            style={ex.superseries_group.trim() ? { borderLeft: `3px solid ${groupColor(ex.superseries_group.trim())}` } : undefined}
            draggable
            onDragStart={(e) => onHandleDragStart(di, ei, e)}
            onDragEnd={endDrag}
            onDragOver={(e) => onRowDragOver(di, ei, e)}
            onDragLeave={(e) => onRowDragLeave(di, ei, e)}
            onDrop={(e) => onRowDrop(di, ei, e)}
            onClick={() => { if (recienArrastro.current) { recienArrastro.current = false; return; } setEditCard({ di, ei }); }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') setEditCard({ di, ei }); }}
          >
            <button
              type="button"
              className="drag-handle"
              draggable
              ref={(el) => { handleRefs.current[ex.id] = el; }}
              onClick={(e) => e.stopPropagation()}
              onDragStart={(e) => onHandleDragStart(di, ei, e)}
              onDragEnd={endDrag}
              onKeyDown={(e) => { e.stopPropagation(); onHandleKeyDown(di, ei, e); }}
              title="Arrastra para reordenar o mover a otro día"
              aria-label={`Reordenar ${ex.name || 'ejercicio'} (${ei + 1} de ${day.exercises.length})`}
            >
              ⠿
            </button>
            <MiniBody grupo={ex.muscle_group} height={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="board-card-name" style={{ fontSize: 12 }}>{ex.name || '(elige el ejercicio)'}</div>
              <div className="board-card-sub" style={{ fontSize: 10 }}>
                {[
                  `${ex.series.length} × ${ex.reps_objective.trim() || '—'}`,
                  ex.target_rir.trim() ? `RIR ${ex.target_rir.trim()}` : null,
                ].filter(Boolean).join(' · ')}
              </div>
              <div className="board-card-badges">
                {ex.superseries_group.trim() && (
                  <span className="board-badge" style={{ borderColor: groupColor(ex.superseries_group.trim()), color: groupColor(ex.superseries_group.trim()) }}>
                    ⛓ {ex.superseries_group.trim().toUpperCase()}
                  </span>
                )}
                {ex.video_url && <span className="board-badge">▶</span>}
              </div>
            </div>
            <button
              className="icon-btn"
              style={{ width: 24, height: 24 }}
              title="Duplicar ejercicio"
              onClick={(e) => { e.stopPropagation(); duplicarEjercicio(di, ei); }}
            >
              ⧉
            </button>
            <button
              className="icon-btn"
              style={{ width: 24, height: 24 }}
              title="Quitar"
              onClick={(e) => { e.stopPropagation(); removeExercise(di, ei); }}
            >
              ✕
            </button>
          </div>
        ))}

        <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 11, width: '100%' }} onClick={() => addExercise(di)}>
          + EJERCICIO
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      {/* EL GRAN CALENDARIO: semanas hacia abajo, columnas Lun..Dom. La celda
          donde vive el bloque ES su día de la semana. */}
      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{ minWidth: 1400 }}>
          {semanas.map((semana, si) => (
            <section key={semana.id} className="cal-semana">
              <div className="cal-semana-head">
                <span className="board-day-num" style={{ color: 'var(--accent)' }}>S{si + 1}</span>
                <input
                  className="cal-semana-nombre"
                  defaultValue={semana.name}
                  onBlur={(e) => { if (e.target.value.trim() !== semana.name) renombrarSemana(semana.id, e.target.value); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  aria-label={`Nombre de la semana ${si + 1}`}
                />
                <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 11 }} onClick={() => duplicarSemana(semana.id)}>
                  DUPLICAR SEMANA
                </button>
                {semanas.length > 1 && (
                  <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 11 }} onClick={() => quitarSemana(semana.id)}>
                    QUITAR
                  </button>
                )}
              </div>

              <div className="cal-grilla">
                {COLUMNAS.map((col, c) => {
                  const weekDayJs = WEEKDAY_DE_COLUMNA[c];
                  const clave = `${semana.id}:${c}`;
                  const bloques = days
                    .map((d, di) => ({ d, di }))
                    .filter(({ d }) => d.weekId === semana.id && columnaDeWeekDay(d.week_day) === c && d.week_day != null);
                  // días heredados sin día asignado: se muestran en Lun
                  const sueltos = c === 0
                    ? days.map((d, di) => ({ d, di })).filter(({ d }) => d.weekId === semana.id && d.week_day == null)
                    : [];
                  return (
                    <div
                      key={c}
                      className="cal-celda"
                      onDragOver={(e) => {
                        if (dragDia != null) { e.preventDefault(); setSobreCelda(clave); }
                      }}
                      onDragLeave={(e) => {
                        if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) {
                          setSobreCelda((s) => (s === clave ? null : s));
                        }
                      }}
                      onDrop={(e) => {
                        if (dragDia == null) return;
                        e.preventDefault();
                        moverDiaACelda(dragDia, semana.id, weekDayJs);
                        endDrag();
                      }}
                      style={sobreCelda === clave && dragDia != null
                        ? { boxShadow: 'inset 0 0 0 2px var(--text)' }
                        : undefined}
                    >
                      <span className="cal-col-label">{col}</span>
                      {[...bloques, ...sueltos].map(({ d, di }) => tarjetaDia(d, di))}
                      <button
                        type="button"
                        className="cal-add-dia"
                        onClick={() => addDay(semana.id, weekDayJs)}
                        title={`Crear un día el ${col.toLowerCase()} de esta semana`}
                      >
                        +
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          <button type="button" className="board-add-day" style={{ width: '100%', minHeight: 56, marginTop: 12 }} onClick={crearSemana}>
            + AGREGAR SEMANA
          </button>
        </div>
      </div>

      {/* Modal de detalle del ejercicio: acá viven todos los campos */}
      {editCard && days[editCard.di]?.exercises[editCard.ei] && (() => {
        const { di, ei } = editCard;
        const ex = days[di].exercises[ei];
        return (
          <div className="modal-overlay" onClick={() => setEditCard(null)}>
            <div className="modal-card" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <MiniBody grupo={ex.muscle_group} height={84} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {ex.library_id || !isTmp(ex.id) ? (
                    <div>
                      <h3 style={{ margin: 0 }}>{ex.name}</h3>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '6px 10px', fontSize: 11, marginTop: 8 }}
                        onClick={() => reemplazarEjercicio(di, ei)}
                        title="El actual sale y eliges otro manteniendo series y objetivos"
                      >
                        ⇄ CAMBIAR EJERCICIO
                      </button>
                    </div>
                  ) : (
                    <LibrarySearch
                      onPick={(item) => pickFromLibrary(di, ei, item)}
                      onCreate={(query) => setLibForm({ di, ei, name: query, nameEn: '', muscle: '', equipment: '' })}
                    />
                  )}
                  <input
                    className="ex-input"
                    style={{ width: '100%', boxSizing: 'border-box', marginTop: 8 }}
                    value={ex.muscle_group}
                    onChange={(e) => updateEx(di, ei, { muscle_group: e.target.value })}
                    placeholder="Grupo muscular"
                  />
                </div>
              </div>

              <div className="board-card-grid" style={{ marginTop: 14 }}>
                <div className="bfield">
                  <span>Series</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => changeSeries(di, ei, -1)}>−</button>
                    <strong className="ex-mono" style={{ minWidth: 16, textAlign: 'center' }}>{ex.series.length}</strong>
                    <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => changeSeries(di, ei, 1)}>+</button>
                  </div>
                </div>
                <div className="bfield">
                  <span>Reps</span>
                  <input className="ex-input ex-input-mono" value={ex.reps_objective}
                    onChange={(e) => updateEx(di, ei, { reps_objective: e.target.value })} placeholder="10-12" />
                </div>
                <div className="bfield">
                  <span>Ref</span>
                  <div style={{ display: 'flex', gap: 4, minWidth: 0 }}>
                    <input className="ex-input ex-input-mono" style={{ minWidth: 0 }} value={ex.ref_weight}
                      onChange={(e) => updateEx(di, ei, { ref_weight: e.target.value })} placeholder="0" inputMode="decimal" />
                    <select className="ex-input ex-input-mono" style={{ flexShrink: 0, width: 62 }} value={ex.unit}
                      onChange={(e) => updateEx(di, ei, { unit: e.target.value as 'kg' | 'lb' })}>
                      <option value="kg">kg</option>
                      <option value="lb">lb</option>
                    </select>
                  </div>
                </div>
                <div className="bfield">
                  <span>Descanso</span>
                  <input className="ex-input ex-input-mono" value={ex.rest_seconds}
                    onChange={(e) => updateEx(di, ei, { rest_seconds: e.target.value })} placeholder="seg" inputMode="numeric" />
                </div>
                <div className="bfield">
                  <span>RIR</span>
                  <input className="ex-input ex-input-mono" value={ex.target_rir}
                    onChange={(e) => updateEx(di, ei, { target_rir: e.target.value })} placeholder="2-3" />
                </div>
                <div className="bfield">
                  <span>Biserie</span>
                  <input
                    className="ex-input"
                    value={ex.superseries_group}
                    onChange={(e) => updateEx(di, ei, { superseries_group: e.target.value })}
                    placeholder="ej: A"
                    title="Mismo texto = encadenados como biserie/triserie, agrupados y coloreados para el cliente."
                    style={ex.superseries_group.trim() ? { borderLeft: `3px solid ${groupColor(ex.superseries_group.trim())}` } : undefined}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 10, flexWrap: 'wrap' }}>
                <ExerciseVideoCell
                  videoUrl={ex.video_url}
                  uid={uid}
                  onChange={(url) => {
                    updateEx(di, ei, { video_url: url });
                    if (!isTmp(ex.id)) {
                      supabase.from('program_template_exercises').update({ video_url: url }).eq('id', ex.id)
                        .then(({ error: e }) => { if (e) setError(`El video no quedó guardado: ${e.message}`); });
                    }
                  }}
                />
                <button className="btn btn-primary" style={{ padding: '10px 22px' }} onClick={() => setEditCard(null)}>
                  LISTO
                </button>
              </div>
              <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>
                Los cambios quedan en el calendario — recuerda GUARDAR CAMBIOS al final.
              </p>
            </div>
          </div>
        );
      })()}

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

      {/* Anuncio para lectores de pantalla: sin esto, mover es mudo. */}
      <div className="sr-only" role="status" aria-live="polite">{announcement}</div>

      <div className="save-bar">
        {error && <span style={{ color: 'var(--warning)', fontSize: 13, marginRight: 'auto' }}>{error}</span>}
        {msg && <span className="toast" style={{ marginRight: 'auto' }}>{msg}</span>}
        {dirty && !error && !msg && <span className="muted" style={{ marginRight: 'auto', fontSize: 13 }}>Cambios sin guardar</span>}
        <button className="btn btn-primary" onClick={save} disabled={saving || !dirty}>
          {saving ? 'GUARDANDO…' : 'GUARDAR CAMBIOS'}
        </button>
      </div>
    </div>
  );
}
