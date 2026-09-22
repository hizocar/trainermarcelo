'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import LibrarySearch, { type LibItem } from '@/components/LibrarySearch';
import ExerciseVideoCell from '@/components/ExerciseVideoCell';
import { resolverVideo, type VideoLib } from '@/lib/videoBiblioteca';
import MiniBody from '@/components/MiniBody';
import SetTable, { type EditSet } from '@/components/SetTable';
import { resolverSerie, aplanarSeries, type EscalaIntensidad, type TipoVolumen } from '@/lib/objetivoSerie';
import { aEditSet, aResuelta, resumenSets } from '@/lib/setsEditor';
import type { PlanDay } from '@/lib/types';

const WEEKDAYS = ['—', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
// índice del array → week_day real (0=Dom … 6=Sáb); '—' = null
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

// Tipo MIME propio para el arrastre de filas. Con 'text/plain' el navegador aplica
// su comportamiento por defecto si la fila se suelta fuera de la tabla — por ejemplo
// sobre el input del nombre del día — e inserta ahí el texto arrastrado. Un tipo
// desconocido no tiene comportamiento por defecto: soltar afuera no escribe nada.
const DRAG_MIME = 'application/x-elitefit-ex';
const DRAG_MIME_DIA = 'application/x-elitefit-dia';

type EditSeries = EditSet;
interface EditExercise {
  id: string;
  name: string;
  library_id: string | null;
  name_en: string | null;
  muscle_group: string;
  unit: 'kg' | 'lb';
  /** qué mide el volumen de los sets */
  volume_type: TipoVolumen;
  /** 1 o 2 escalas de intensidad (p. ej. RIR + %1RM) */
  intensity_types: EscalaIntensidad[];
  /** observaciones del coach: el alumno las ve en su tarjeta */
  notes: string;
  superseries_group: string;
  video_url: string | null;
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
      unit: (e.unit as 'kg' | 'lb') ?? 'kg',
      volume_type: ((e as any).volume_type as TipoVolumen) ?? 'reps',
      intensity_types: ((e as any).intensity_types as EscalaIntensidad[])?.length ? (e as any).intensity_types : ['rir'],
      notes: e.notes ?? '',
      superseries_group: e.superseries_group ?? '',
      video_url: (e as any).video_url ?? null,
      // cada set resuelto con la herencia set → ejercicio (v45)
      series: (e.exercise_series ?? []).map((s) => aEditSet(resolverSerie(e, s as any), s.id)),
    })),
  }));
}

export default function PlanEditor({ planId, planWeekId, initialDays }: { planId: string; planWeekId: string; initialDays: PlanDay[] }) {
  const supabase = createClient();
  const [days, setDays] = useState<EditDay[]>(() => toEditModel(initialDays));
  const [archDays, setArchDays] = useState<string[]>([]);
  const [archEx, setArchEx] = useState<string[]>([]);
  const [delSeries, setDelSeries] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);

  // formulario "agregar a biblioteca": { di, ei } de la fila que lo abrió
  const [libForm, setLibForm] = useState<{ di: number; ei: number; name: string; nameEn: string; muscle: string; equipment: string } | null>(null);
  const [libSaving, setLibSaving] = useState(false);
  const [editCard, setEditCard] = useState<{ di: number; ei: number } | null>(null);
  // texto escrito en el buscador SIN elegir de la lista: cerrar así perdía el
  // cambio y dejaba la tarjeta en "(elige el ejercicio)" (reporte de Sebastián)
  const [pendienteLib, setPendienteLib] = useState<{ texto: string; hayResultados: boolean }>({ texto: '', hayResultados: false });

  // abrir otro ejercicio empieza de cero: el texto a medio escribir no viaja
  useEffect(() => { setPendienteLib({ texto: '', hayResultados: false }); }, [editCard?.di, editCard?.ei]);

  /** Cierra el detalle, salvo que haya un ejercicio a medio elegir. */
  function cerrarDetalle() {
    if (pendienteLib.texto.length >= 2) {
      setError(pendienteLib.hayResultados
        ? `Elige “${pendienteLib.texto}” de la lista (o usa ↑ ↓ y Enter) para cambiar el ejercicio.`
        : `“${pendienteLib.texto}” no está en la biblioteca: elígelo de la lista o agrégalo con “+ Agregar a la biblioteca”.`);
      return;
    }
    setError(null);
    setEditCard(null);
  }

  // arrastre de filas: fila tomada y fila sobre la que se soltaría
  const [drag, setDrag] = useState<{ di: number; ei: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ di: number; ei: number } | null>(null);
  // asideros por ejercicio, para devolverles el foco tras mover con el teclado
  const handleRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [announcement, setAnnouncement] = useState('');
  // arrastre de columnas de día (el video de Yharel): día tomado y destino
  const [dragDia, setDragDia] = useState<number | null>(null);
  const [sobreDia, setSobreDia] = useState<number | null>(null);
  // columna iluminada mientras un ejercicio de OTRO día pasa por encima
  const [sobreColEj, setSobreColEj] = useState<number | null>(null);
  // el clic que sigue a un arrastre no debe abrir el modal
  const recienArrastro = useRef(false);

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
        !window.confirm(`¿Quitar "${day.name}" del plan? El historial del cliente se conserva.`)) return;
    if (!isTmp(day.id)) setArchDays((x) => [...x, day.id]);
    mutate((d) => { d.splice(di, 1); return d; });
  }

  function addExercise(di: number) {
    mutate((d) => {
      d[di].exercises.push({
        id: tmpId(), name: '', library_id: null, name_en: null, muscle_group: '',
        unit: 'kg', volume_type: 'reps', intensity_types: ['rir'], notes: '', superseries_group: '',
        video_url: null,
        series: [nuevoSet(), nuevoSet(), nuevoSet()],
      });
      return d;
    });
    setEditCard({ di, ei: days[di].exercises.length });
  }
  function removeExercise(di: number, ei: number) {
    const ex = days[di].exercises[ei];
    if (!isTmp(ex.id) &&
        !window.confirm(`¿Quitar "${ex.name}" del plan? El historial del cliente se conserva.`)) return;
    if (!isTmp(ex.id)) setArchEx((x) => [...x, ex.id]);
    mutate((d) => { d[di].exercises.splice(ei, 1); return d; });
    setEditCard(null);
  }

  // reordena un ejercicio dentro de su día — usado por la pizarra semanal
  function moveExercise(di: number, ei: number, dir: -1 | 1) {
    const j = ei + dir;
    if (j < 0 || j >= days[di].exercises.length) return;
    mutate((d) => {
      const list = d[di].exercises;
      [list[ei], list[j]] = [list[j], list[ei]];
      return d;
    });
  }

  // mueve un ejercicio a otra posición del mismo día (el orden se persiste solo:
  // al guardar, order_index sale de la posición en el arreglo)
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

  // ── días completos: mover, duplicar; y ejercicios entre días ──
  function moverDia(from: number, to: number) {
    if (to < 0 || to >= days.length || from === to) return;
    const nombre = days[from].name || 'Día';
    mutate((d) => { const [x] = d.splice(from, 1); d.splice(to, 0, x); return d; });
    setAnnouncement(`${nombre}, ahora es el día ${to + 1} de ${days.length}`);
  }

  function duplicarDia(di: number) {
    mutate((d) => {
      const src = d[di];
      d.splice(di + 1, 0, {
        id: tmpId(), name: `${src.name} (copia)`, week_day: null,
        exercises: src.exercises.map((e) => ({
          ...e, id: tmpId(),
          series: e.series.map((x) => ({ ...x, id: tmpId() })),
        })),
      });
      return d;
    });
  }

  function duplicarEjercicio(di: number, ei: number) {
    mutate((d) => {
      const e = d[di].exercises[ei];
      d[di].exercises.splice(ei + 1, 0, {
        ...e, id: tmpId(),
        series: e.series.map((x) => ({ ...x, id: tmpId() })),
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
    setAnnouncement(`${nombre} movido al día ${toDi + 1}`);
  }

  // cambiar el ejercicio conservando series y objetivos: el actual sale
  // (con su historial a salvo) y entra uno nuevo en su lugar, listo para
  // elegir de la biblioteca — el punto 9 del feedback de Yharel
  function reemplazarEjercicio(di: number, ei: number) {
    const ex = days[di].exercises[ei];
    if (!isTmp(ex.id)) setArchEx((x) => [...x, ex.id]);
    mutate((d) => {
      const e = d[di].exercises[ei];
      d[di].exercises[ei] = {
        ...e, id: tmpId(), name: '', library_id: null, name_en: null,
        series: e.series.map((x) => ({ ...x, id: tmpId() })),
      };
      return d;
    });
  }

  function onHandleDragStart(di: number, ei: number, e: React.DragEvent<HTMLElement>) {
    recienArrastro.current = true;
    setDrag({ di, ei });
    e.dataTransfer.effectAllowed = 'move';
    // el dataTransfer necesita datos (Firefox si no, no arrastra), pero con un tipo
    // propio: soltar la fila fuera de la tabla no debe escribir nada en ningún campo
    e.dataTransfer.setData(DRAG_MIME, String(ei));
    // arrastrar la fila completa, no solo el asidero
    const row = e.currentTarget.closest('.board-card');
    if (row) e.dataTransfer.setDragImage(row, 12, 12);
  }
  function endDrag() {
    setDrag(null);
    setDropTarget(null);
    setSobreColEj(null);
    // el click sintético que dispara el navegador tras soltar no cuenta
    setTimeout(() => { recienArrastro.current = false; }, 0);
  }

  function onRowDragOver(di: number, ei: number, e: React.DragEvent<HTMLElement>) {
    // Dentro del mismo día reordena; entre días MUEVE (feedback de Yharel).
    // El estado `drag` ya garantiza que el arrastre salió de un asidero
    // nuestro; no se consulta dataTransfer.types acá porque Safari es
    // irregular exponiendo tipos propios durante el dragover.
    if (!drag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropTarget?.di !== di || dropTarget?.ei !== ei) setDropTarget({ di, ei });
  }
  // Sin esto el resalte queda pegado en la última fila sobrevolada al salir del tbody.
  // Al pasar de una fila a otra, dragleave llega DESPUÉS del dragover de la nueva:
  // por eso solo se limpia si el destino sigue siendo esta fila.
  function onRowDragLeave(di: number, ei: number, e: React.DragEvent<HTMLElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDropTarget((cur) => (cur?.di === di && cur.ei === ei ? null : cur));
  }
  function onRowDrop(di: number, ei: number, e: React.DragEvent<HTMLElement>) {
    if (!drag) return;
    e.preventDefault();
    e.stopPropagation(); // que no lo procese también la columna
    // el origen viaja en el dataTransfer con nuestro tipo; el estado es el respaldo
    const raw = e.dataTransfer.getData(DRAG_MIME);
    const from = raw === '' ? drag.ei : Number(raw);
    if (Number.isInteger(from)) {
      if (drag.di === di) reorderExercise(di, from, ei);
      else moverEjercicioEntreDias(drag.di, from, di, ei);
    }
    endDrag();
  }
  // Teclado: el arrastre nativo no funciona con el dedo ni sin mouse.
  function onHandleKeyDown(di: number, ei: number, e: React.KeyboardEvent) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault(); // que las flechas no hagan scroll de la página
    const list = days[di].exercises;
    const to = ei + (e.key === 'ArrowUp' ? -1 : 1);
    if (to < 0 || to >= list.length) return;
    const movedId = list[ei].id;
    reorderExercise(di, ei, to);
    // mover un nodo del DOM es quitarlo e insertarlo, y eso lo desenfoca en Chrome
    // y Safari: sin esto la segunda flecha ya no movería nada
    requestAnimationFrame(() => handleRefs.current[movedId]?.focus());
  }

  // ── sets del ejercicio (tabla de sets) ──
  function nuevoSet(): EditSet {
    return aEditSet(resolverSerie({}, {}), tmpId());
  }
  function updateSet(di: number, ei: number, si: number, patch: Partial<EditSet>) {
    mutate((d) => {
      const sets = d[di].exercises[ei].series;
      sets[si] = { ...sets[si], ...patch };
      return d;
    });
  }
  function addSet(di: number, ei: number) {
    mutate((d) => {
      const sets = d[di].exercises[ei].series;
      // copia el último: casi siempre el set nuevo es igual y se ajusta uno
      const ultimo = sets[sets.length - 1];
      sets.push(ultimo ? { ...ultimo, id: tmpId() } : nuevoSet());
      return d;
    });
  }
  function duplicateSet(di: number, ei: number, si: number) {
    mutate((d) => {
      const sets = d[di].exercises[ei].series;
      sets.splice(si + 1, 0, { ...sets[si], id: tmpId() });
      return d;
    });
  }
  function removeSet(di: number, ei: number, si: number) {
    const sets = days[di].exercises[ei].series;
    if (sets.length <= 1) return;
    // el marcado para borrar va FUERA del updater: React puede re-ejecutarlo (StrictMode)
    if (!isTmp(sets[si].id)) setDelSeries((x) => [...x, sets[si].id]);
    mutate((d) => { d[di].exercises[ei].series.splice(si, 1); return d; });
  }

  async function pickFromLibrary(di: number, ei: number, item: LibItem) {
    updateEx(di, ei, {
      name: item.name,
      library_id: item.id,
      name_en: item.name_en,
      muscle_group: item.muscle_group ?? '',
    });
    // hereda el video de la biblioteca (v41): el del propio coach manda;
    // si no tiene, un público. Un privado ajeno jamás llega hasta acá — la
    // RLS no lo entrega.
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
      // 1) series eliminadas (solo las que no tienen registros; si tienen, FK avisa)
      if (delSeries.length) {
        const { error } = await supabase.from('exercise_series').delete().in('id', delSeries);
        if (error) throw error;
      }
      // 2) ejercicios quitados → archivar (el historial del cliente se conserva)
      if (archEx.length) {
        const { error } = await supabase.from('exercises').update({ archived: true }).in('id', archEx);
        if (error) throw error;
      }
      // 3) días quitados → archivar
      if (archDays.length) {
        const { error } = await supabase.from('training_days').update({ archived: true }).in('id', archDays);
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
            .insert({ plan_id: planId, plan_week_id: planWeekId, day_number: dayNumber, name: day.name, week_day: day.week_day })
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
          // el ejercicio lleva el set 1 (lo que lee la app publicada); cada set, lo distinto
          const plano = aplanarSeries(ex.series.map(aResuelta));
          const fields = {
            muscle_group: ex.muscle_group.trim() || null,
            ...plano.ejercicio,
            reps_objective: plano.ejercicio.reps_objective ?? '',
            unit: ex.unit,
            volume_type: ex.volume_type,
            intensity_types: ex.intensity_types,
            notes: ex.notes.trim() || null,
            superseries_group: ex.superseries_group.trim() || null,
            video_url: ex.video_url,
            order_index: ei,
          };
          let exId = ex.id;
          if (isTmp(exId)) {
            // el nombre viene de la biblioteca y no se vuelve a editar
            const { data, error } = await supabase
              .from('exercises')
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
            const { error } = await supabase.from('exercises').update({ ...fields, day_id: dayId }).eq('id', exId);
            if (error) throw error;
          }

          for (let si = 0; si < ex.series.length; si++) {
            const s = ex.series[si];
            if (isTmp(s.id)) {
              const { error } = await supabase
                .from('exercise_series')
                .insert({ exercise_id: exId, series_number: si + 1, ...plano.series[si] });
              if (error) throw error;
            } else {
              const { error } = await supabase
                .from('exercise_series')
                .update({ series_number: si + 1, ...plano.series[si] })
                .eq('id', s.id);
              if (error) throw error;
            }
          }
        }
      }

      setArchDays([]); setArchEx([]); setDelSeries([]);
      setDirty(false);
      setMsg('Cambios guardados ✓ — ya se ven en la app del cliente.');
    } catch (e: any) {
      // 23503 = violación de foreign key: la serie ya tiene entrenamientos registrados
      setError(
        e?.code === '23503'
          ? 'No se pudo reducir series: el cliente ya registró entrenamientos en ellas. Recarga la página para restaurar.'
          : e?.message ?? 'No se pudieron guardar los cambios.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      {/* El tablero v2: tarjetas compactas con el músculo encendido; el
          detalle se edita en un modal. Mismos handlers de siempre. */}
      <div className="board-scroll board-edit">
        {days.map((day, di) => (
          <div
            key={day.id}
            className="board-col-edit"
            onDragOver={(e) => { if (drag && drag.di !== di) { e.preventDefault(); setSobreColEj(di); } }}
            onDragLeave={(e) => {
              if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) {
                setSobreColEj((s) => (s === di ? null : s));
              }
            }}
            onDrop={(e) => {
              if (!drag || drag.di === di) return;
              e.preventDefault();
              moverEjercicioEntreDias(drag.di, drag.ei, di, day.exercises.length);
              endDrag();
            }}
            style={sobreColEj === di && drag && drag.di !== di
              ? { boxShadow: 'inset 0 0 0 2px var(--accent)' }
              : undefined}
          >
            <div
              className="board-day-banner"
              onDragOver={(e) => { if (dragDia != null && dragDia !== di) { e.preventDefault(); setSobreDia(di); } }}
              onDragLeave={() => setSobreDia((s) => (s === di ? null : s))}
              onDrop={(e) => {
                if (dragDia == null) return;
                e.preventDefault();
                e.stopPropagation();
                moverDia(dragDia, di);
                setDragDia(null);
                setSobreDia(null);
              }}
              style={sobreDia === di && dragDia !== di ? { boxShadow: '0 0 0 2px var(--text)' } : undefined}
            >
              <button
                type="button"
                className="board-day-drag"
                draggable
                onDragStart={(e) => {
                  setDragDia(di);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData(DRAG_MIME_DIA, String(di));
                }}
                onDragEnd={() => { setDragDia(null); setSobreDia(null); }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft') { e.preventDefault(); moverDia(di, di - 1); }
                  if (e.key === 'ArrowRight') { e.preventDefault(); moverDia(di, di + 1); }
                }}
                title="Arrastra la columna para reordenar los días (o usa ← →)"
                aria-label={`Mover el día ${day.name || di + 1} (flechas izquierda y derecha)`}
              >
                ⠿
              </button>
              <span className="board-day-num">DÍA {di + 1}</span>
              <input
                className="board-day-name"
                value={day.name}
                onChange={(e) => updateDay(di, { name: e.target.value })}
                placeholder="Nombre del día"
              />
              <select
                className="board-day-week"
                value={WEEKDAY_VALUE.findIndex((v) => v === day.week_day)}
                onChange={(e) => updateDay(di, { week_day: WEEKDAY_VALUE[Number(e.target.value)] })}
              >
                {WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}</option>)}
              </select>
              <button className="board-day-x" title="Duplicar día (con sus ejercicios)" onClick={() => duplicarDia(di)}>⧉</button>
              <button className="board-day-x" title="Quitar día" onClick={() => removeDay(di)}>✕</button>
            </div>

            {/* arriba: en un día largo, abajo quedaba lejos (pedido de Yharel) */}
            <button className="btn btn-ghost" style={{ padding: '9px 12px', fontSize: 12 }} onClick={() => addExercise(di)}>
              + Agregar ejercicio
            </button>

            {day.exercises.map((ex, ei) => (
              <div
                key={ex.id}
                className={[
                  'board-card', 'board-card-v2',
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
                  title="Arrastra para reordenar, o usa las flechas ↑ ↓ del teclado"
                  aria-label={`Reordenar ${ex.name || 'ejercicio'} (${ei + 1} de ${day.exercises.length})`}
                >
                  ⠿
                </button>
                <MiniBody grupo={ex.muscle_group} height={62} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="board-card-name">{ex.name || '(elige el ejercicio)'}</div>
                  <div className="board-card-sub">
                    {[ex.muscle_group.trim() || null, resumenSets(ex.series, ex.intensity_types, ex.volume_type, ex.unit)].filter(Boolean).join(' · ')}
                  </div>
                  <div className="board-card-badges">
                    {ex.superseries_group.trim() && (
                      <span className="board-badge" style={{ borderColor: groupColor(ex.superseries_group.trim()), color: groupColor(ex.superseries_group.trim()) }}>
                        ⛓ {ex.superseries_group.trim().toUpperCase()}
                      </span>
                    )}
                    {ex.video_url && <span className="board-badge">▶ VIDEO</span>}
                    {ex.notes.trim() && <span className="board-badge" title={ex.notes.trim()}>✎ NOTA</span>}
                  </div>
                </div>
                <button
                  className="icon-btn"
                  title="Duplicar ejercicio"
                  onClick={(e) => { e.stopPropagation(); duplicarEjercicio(di, ei); }}
                >
                  ⧉
                </button>
                <button
                  className="icon-btn"
                  title="Quitar (conserva historial)"
                  onClick={(e) => { e.stopPropagation(); removeExercise(di, ei); }}
                >
                  ✕
                </button>
              </div>
            ))}

            {day.exercises.length === 0 && <span className="board-empty">Sin ejercicios todavía.</span>}

          </div>
        ))}

        <button type="button" className="board-add-day" onClick={addDay}>
          + AGREGAR DÍA
        </button>
      </div>

      {/* Modal de detalle del ejercicio: acá viven todos los campos */}
      {editCard && days[editCard.di]?.exercises[editCard.ei] && (() => {
        const { di, ei } = editCard;
        const ex = days[di].exercises[ei];
        return (
          <div className="modal-overlay" onClick={cerrarDetalle}>
            <div className="modal-card" style={{ maxWidth: 860 }} onClick={(e) => e.stopPropagation()}>
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
                        title="El actual sale (su historial se conserva) y eliges otro manteniendo series y objetivos"
                      >
                        ⇄ CAMBIAR EJERCICIO
                      </button>
                    </div>
                  ) : (
                    <LibrarySearch
                      onPendiente={setPendienteLib}
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

              <SetTable
                volumeType={ex.volume_type}
                intensityTypes={ex.intensity_types}
                unit={ex.unit}
                sets={ex.series}
                onScales={(p) => updateEx(di, ei, {
                  ...(p.volumeType ? { volume_type: p.volumeType } : {}),
                  ...(p.intensityTypes ? { intensity_types: p.intensityTypes } : {}),
                  ...(p.unit ? { unit: p.unit } : {}),
                })}
                onSet={(si, p) => updateSet(di, ei, si, p)}
                onAdd={() => addSet(di, ei)}
                onDuplicate={(si) => duplicateSet(di, ei, si)}
                onRemove={(si) => removeSet(di, ei, si)}
              />

              <div className="board-card-grid" style={{ marginTop: 12, gridTemplateColumns: '160px 1fr' }}>
                <div className="bfield">
                  <span>Biserie</span>
                  <input
                    className="ex-input"
                    value={ex.superseries_group}
                    onChange={(e) => updateEx(di, ei, { superseries_group: e.target.value })}
                    placeholder="ej: A"
                    title="Mismo texto = encadenados como biserie/triserie, agrupados y coloreados para el cliente."
                    style={{ ...(ex.superseries_group.trim() ? { borderLeft: `3px solid ${groupColor(ex.superseries_group.trim())}` } : {}) }}
                  />
                <small className="muted" style={{ fontSize: 11 }}>Misma letra = encadenados</small>
                </div>
              </div>

              {error && (
                <p style={{ color: 'var(--warning)', fontSize: 12, marginTop: 12 }}>{error}</p>
              )}

              <div className="bfield" style={{ marginTop: 12 }}>
                <span>Observaciones del coach</span>
                <textarea
                  className="ex-input"
                  rows={3}
                  value={ex.notes}
                  onChange={(e) => updateEx(di, ei, { notes: e.target.value })}
                  placeholder="Ej: codos pegados al cuerpo, controla la bajada. Si molesta el hombro, baja el peso."
                  style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.45 }}
                />
                <small className="muted" style={{ fontSize: 11 }}>El alumno las ve en la tarjeta del ejercicio mientras entrena.</small>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 10, flexWrap: 'wrap' }}>
                <ExerciseVideoCell
                  videoUrl={ex.video_url}
                  uid={uid}
                  onChange={(url) => {
                    updateEx(di, ei, { video_url: url });
                    // el video queda guardado AL INSTANTE en ejercicios ya
                    // existentes: subirlo y cerrar sin GUARDAR CAMBIOS lo
                    // perdía ("no se guardan los videos que subo")
                    if (!isTmp(ex.id)) {
                      supabase.from('exercises').update({ video_url: url }).eq('id', ex.id)
                        .then(({ error: e }) => { if (e) setError(`El video no quedó guardado: ${e.message}`); });
                    }
                  }}
                />
                <button className="btn btn-primary" style={{ padding: '10px 22px' }} onClick={cerrarDetalle}>
                  LISTO
                </button>
              </div>
              <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>
                Los cambios quedan en el tablero — recuerda GUARDAR CAMBIOS al final.
              </p>
            </div>
          </div>
        );
      })()}

      {/* Modal: crear ejercicio en la biblioteca */}
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

      {/* Anuncio para lectores de pantalla: sin esto, reordenar es mudo. */}
      <div className="sr-only" role="status" aria-live="polite">{announcement}</div>

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
