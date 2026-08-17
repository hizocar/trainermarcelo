import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Modal, Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { ImagePickerAsset } from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { User, WorkoutPlan, TrainingDay, Exercise } from '../../types';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';
import { showAlert, showConfirm } from '../../lib/alert';
import { pickImage, pickVideo, uploadMedia, videoExtension } from '../../lib/media';
import { WEEK_DAYS_SHORT as WEEK_DAYS } from '../../lib/weeks';
import { parseRepsRange, formatRepsRange } from '../../lib/reps';
import {
  chainWith, unchain, dissolveGroup, groupNameFor, colorForLabel, normalizeGroups,
} from '../../lib/superseries';

const REST_OPTIONS = [30, 45, 60, 90, 120, 180];
const RIR_OPTIONS = ['0', '0-1', '1-2', '2-3', '3+'];
const MUSCLE_GROUPS = [
  'Pecho', 'Espalda alta', 'Espalda baja',
  'Hombro anterior', 'Hombro medial', 'Hombro posterior',
  'Bíceps', 'Tríceps', 'Antebrazos',
  'Cuádriceps', 'Isquiotibiales', 'Aductor',
  'Glúteo mayor', 'Glúteo medio', 'Glúteo menor',
  'Gastrocnemios', 'Core',
];

type RouteParams = { client: User; planWeekId: string; weekLabel?: string };

interface DayWithExercises extends TrainingDay {
  exercises: Exercise[];
}

export default function PlanEditorScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { client, planWeekId, weekLabel } = route.params as RouteParams;
  const { user } = useAuth();

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [days, setDays] = useState<DayWithExercises[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal nuevo día
  const [showDayModal, setShowDayModal] = useState(false);
  const [newDayName, setNewDayName] = useState('');
  const [newDayWeekDay, setNewDayWeekDay] = useState(1);

  // Modal nuevo ejercicio
  const [showExModal, setShowExModal] = useState(false);
  const [targetDayId, setTargetDayId] = useState('');
  const [exName, setExName] = useState('');
  const [exRepsFrom, setExRepsFrom] = useState('');
  const [exRepsTo, setExRepsTo] = useState('');
  const [exUnit, setExUnit] = useState<'kg' | 'lb'>('kg');
  const [exRefWeight, setExRefWeight] = useState('');
  const [exSeries, setExSeries] = useState('3');
  const [exNotes, setExNotes] = useState('');
  const [exMuscle, setExMuscle] = useState('');
  const [exTempo, setExTempo] = useState('');
  const [exRest, setExRest] = useState<number | null>(null);
  const [exTargetRir, setExTargetRir] = useState('');
  const [templates, setTemplates] = useState<{ id: string; name: string; exercises: any[] }[]>([]);
  const [exVideoUrl, setExVideoUrl] = useState('');
  const [exImageUrl, setExImageUrl] = useState<string | null>(null);
  const [exNewImage, setExNewImage] = useState<ImagePickerAsset | null>(null);
  const [exNewVideo, setExNewVideo] = useState<ImagePickerAsset | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [editingEx, setEditingEx] = useState<Exercise | null>(null);
  const [suggestions, setSuggestions] = useState<{ id: string; name: string; name_en: string | null; muscle_group: string; equipment: string | null }[]>([]);
  const [exLibrary, setExLibrary] = useState<{ name_en: string | null; library_id: string | null }>({ name_en: null, library_id: null });
  const [showLibForm, setShowLibForm] = useState(false);
  const [libNameEn, setLibNameEn] = useState('');
  const [libEquipment, setLibEquipment] = useState('');
  const [libSaving, setLibSaving] = useState(false);
  const searchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // El objetivo de reps tal como vino de la base, y si el coach tocó los campos.
  // Un texto legado ("al fallo") se muestra entero en "desde"; si no lo edita,
  // se vuelve a guardar tal cual en vez de reescribirlo desde el formulario.
  const [repsOriginal, setRepsOriginal] = useState<string | null>(null);
  const [repsTocadas, setRepsTocadas] = useState(false);

  // Etiqueta de grupo tal como está guardada en la base (id → superseries_group).
  // Es la referencia de `persistGroups`: al cargar se normaliza solo lo que se
  // muestra, así que compararse con la lista en pantalla dejaba sin escribir
  // justo las filas que la normalización limpió.
  const grupoEnBase = React.useRef<Map<string, string | null>>(new Map());
  // Guarda de concurrencia: los handlers leen `days` del closure y
  // `persistGroups` reemplaza la lista completa del día. Dos toques rápidos en
  // botones distintos calcularían sobre estado viejo —`nextGroupLabel` podría
  // devolver la misma letra a dos pares distintos—, así que mientras hay una
  // persistencia corriendo se ignoran los toques.
  const enVuelo = React.useRef<Promise<void> | null>(null);
  // el ref es la guarda real (síncrona); este estado es solo para que el coach
  // VEA que los controles están inactivos en vez de sentir que no responden
  const [operando, setOperando] = useState(false);

  useEffect(() => { fetchPlan(); fetchTemplates(); }, []);

  async function fetchTemplates() {
    const { data } = await supabase
      .from('day_templates')
      .select('id, name, exercises')
      .order('created_at', { ascending: false });
    setTemplates(data ?? []);
  }

  async function saveDayAsTemplate(day: DayWithExercises) {
    if (day.exercises.length === 0) {
      showAlert('Día vacío', 'Agrega ejercicios antes de guardarlo como plantilla.');
      return;
    }
    const snapshot = day.exercises.map(e => ({
      name: e.name, name_en: e.name_en ?? null, library_id: e.library_id ?? null,
      muscle_group: e.muscle_group ?? null, reps_objective: e.reps_objective,
      unit: e.unit, ref_weight: e.ref_weight ?? null,
      superseries_group: e.superseries_group ?? null,
      tempo: e.tempo ?? null, rest_seconds: e.rest_seconds ?? null, target_rir: e.target_rir ?? null,
      notes: e.notes ?? null, image_url: e.image_url ?? null, video_url: e.video_url ?? null,
    }));
    const { error } = await supabase.from('day_templates').insert({
      coach_id: user!.id, name: day.name, exercises: snapshot,
    });
    if (error) showAlert('Error', error.message);
    else { showAlert('Plantilla guardada', `"${day.name}" (${snapshot.length} ejercicios) quedó disponible para cualquier cliente.`); fetchTemplates(); }
  }

  async function addDayFromTemplate(tpl: { id: string; name: string; exercises: any[] }) {
    if (!plan) return;
    setSaving(true);
    const { data: newDay, error } = await supabase
      .from('training_days')
      .insert({ plan_id: plan.id, plan_week_id: planWeekId, day_number: days.length + 1, name: newDayName.trim() || tpl.name, week_day: newDayWeekDay })
      .select().single();
    if (error || !newDay) { setSaving(false); showAlert('Error', error?.message ?? ''); return; }

    const created: Exercise[] = [];
    for (let i = 0; i < tpl.exercises.length; i++) {
      const t = tpl.exercises[i];
      const { data: ex } = await supabase.from('exercises')
        .insert({ ...t, day_id: newDay.id, order_index: i })
        .select().single();
      if (ex) {
        await supabase.from('exercise_series').insert(
          Array.from({ length: 3 }, (_, s) => ({ exercise_id: ex.id, series_number: s + 1 }))
        );
        grupoEnBase.current.set(ex.id, ex.superseries_group ?? null);
        created.push(ex);
      }
    }
    setDays(prev => [...prev, { ...newDay, exercises: created }]);
    setNewDayName(''); setNewDayWeekDay(1); setShowDayModal(false); setSaving(false);
  }

  async function fetchPlan() {
    const { data: planData } = await supabase
      .from('workout_plans').select('*')
      .eq('client_id', client.id).single();

    let currentPlan = planData;
    if (!currentPlan) {
      const { data: newPlan } = await supabase
        .from('workout_plans')
        .insert({ client_id: client.id, name: `Plan ${client.name}`, created_by: user!.id })
        .select().single();
      currentPlan = newPlan;
    }
    setPlan(currentPlan);

    const { data: daysData } = await supabase
      .from('training_days').select('*')
      .eq('plan_week_id', planWeekId).eq('archived', false).order('week_day');

    const daysWithEx: DayWithExercises[] = [];
    // se guarda la lista CRUDA (antes de normalizar) en `grupoEnBase`: es lo
    // que hay realmente en la base, y contra eso compara `persistGroups`.
    const base = new Map<string, string | null>();
    for (const d of (daysData ?? [])) {
      const { data: exData } = await supabase
        .from('exercises').select('*')
        .eq('day_id', d.id).eq('archived', false).order('order_index');
      for (const e of (exData ?? [])) base.set(e.id, e.superseries_group ?? null);
      // se normaliza solo lo que se muestra: una etiqueta huérfana —de un
      // guardado que quedó a medias, o de planes viejos— dibujaría una píldora
      // de grupo sobre un ejercicio suelto. No se escribe nada al cargar:
      // reescribir los datos del coach a sus espaldas sería peor que el bug.
      // La limpieza se guarda junto con la primera acción real del coach.
      daysWithEx.push({ ...d, exercises: normalizeGroups(encadenables(exData ?? [])) });
    }
    grupoEnBase.current = base;
    setDays(daysWithEx);
    setLoading(false);
  }

  async function addDay() {
    if (!newDayName.trim() || !plan) return;
    setSaving(true);
    const dayNumber = days.length + 1;
    const { data, error } = await supabase
      .from('training_days')
      .insert({ plan_id: plan.id, plan_week_id: planWeekId, day_number: dayNumber, name: newDayName.trim(), week_day: newDayWeekDay })
      .select().single();
    if (!error && data) {
      setDays(prev => [...prev, { ...data, exercises: [] }]);
    }
    setNewDayName('');
    setNewDayWeekDay(1);
    setShowDayModal(false);
    setSaving(false);
  }

  function deleteDay(dayId: string) {
    showConfirm('Eliminar día', 'Se quitará del plan. El historial que el cliente ya registró se conserva.', async () => {
      // archivado, no borrado: los logs del cliente siguen apuntando a este día
      await supabase.from('training_days').update({ archived: true }).eq('id', dayId);
      setDays(prev => prev.filter(d => d.id !== dayId));
    }, 'Eliminar');
  }

  function openAddExercise(dayId: string) {
    setTargetDayId(dayId);
    setExName(''); setExRepsFrom(''); setExRepsTo(''); setExUnit('kg');
    setRepsOriginal(null); setRepsTocadas(false);
    setExRefWeight(''); setExSeries('3');
    setExNotes(''); setExVideoUrl(''); setExImageUrl(null); setExNewImage(null);
    setExMuscle('');
    setExTempo(''); setExRest(null); setExTargetRir('');
    setExLibrary({ name_en: null, library_id: null });
    setExNewVideo(null);
    setEditingEx(null);
    setShowExModal(true);
  }

  async function openEditExercise(ex: Exercise) {
    setTargetDayId(ex.day_id);
    const { count } = await supabase
      .from('exercise_series')
      .select('*', { count: 'exact', head: true })
      .eq('exercise_id', ex.id);
    setExSeries(String(count ?? 3));
    setExName(ex.name);
    const rango = parseRepsRange(ex.reps_objective);
    setExRepsFrom(rango.from);
    setExRepsTo(rango.to);
    // se conserva el objetivo original: si el coach no toca los campos de reps
    // (por ejemplo, entra solo a cambiar las notas) se vuelve a guardar tal
    // cual. Un texto legado como "al fallo" no se pierde ni se trunca.
    setRepsOriginal(ex.reps_objective ?? null);
    setRepsTocadas(false);
    setExUnit(ex.unit);
    setExRefWeight(ex.ref_weight?.toString() ?? '');
    setExNotes(ex.notes ?? '');
    setExMuscle(ex.muscle_group ?? '');
    setExTempo(ex.tempo ?? ''); setExRest(ex.rest_seconds ?? null); setExTargetRir(ex.target_rir ?? '');
    setExLibrary({ name_en: ex.name_en ?? null, library_id: ex.library_id ?? null });
    setExVideoUrl(ex.video_url ?? '');
    setExImageUrl(ex.image_url ?? null);
    setExNewImage(null);
    setExNewVideo(null);
    setEditingEx(ex);
    setShowExModal(true);
  }

  function onExNameChange(v: string) {
    setExName(v);
    setExLibrary({ name_en: null, library_id: null });
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = v.trim();
    if (q.length < 3) { setSuggestions([]); return; }
    searchTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('exercise_library')
        .select('id, name, name_en, muscle_group, equipment')
        .or(`name.ilike.%${q}%,name_en.ilike.%${q}%`)
        .limit(5);
      // no sugerir si ya escribió exactamente ese nombre
      setSuggestions((data ?? []).filter(s => s.name.toLowerCase() !== q.toLowerCase()));
    }, 250);
  }

  function pickSuggestion(s: { id: string; name: string; name_en: string | null; muscle_group: string }) {
    setExName(s.name);
    setExMuscle(s.muscle_group);
    setExLibrary({ name_en: s.name_en, library_id: s.id });
    setSuggestions([]);
    setShowLibForm(false);
  }

  async function addToLibrary() {
    const name = exName.trim();
    if (!name) return;
    if (!exMuscle) {
      showAlert('Falta el grupo muscular', 'Selecciona el grupo muscular (más abajo) antes de agregar el ejercicio a la biblioteca.');
      return;
    }
    setLibSaving(true);
    const { data, error } = await supabase
      .from('exercise_library')
      .insert({
        name,
        name_en: libNameEn.trim() || null,
        muscle_group: exMuscle,
        equipment: libEquipment.trim() || null,
        coach_id: user!.id,
      })
      .select('id, name, name_en, muscle_group')
      .single();
    setLibSaving(false);
    if (error) { showAlert('No se pudo agregar', error.message); return; }
    setExLibrary({ name_en: data.name_en, library_id: data.id });
    setSuggestions([]);
    setShowLibForm(false);
    setLibNameEn(''); setLibEquipment('');
  }

  async function chooseImage() {
    const asset = await pickImage();
    if (asset) setExNewImage(asset);
  }

  async function chooseVideo() {
    const asset = await pickVideo();
    if (asset) {
      setExNewVideo(asset);
      setExVideoUrl(''); // el archivo reemplaza al link
    }
  }

  async function saveExercise() {
    if (!exName.trim()) return;
    if (!editingEx && !exLibrary.library_id) {
      showAlert(
        'Elige un ejercicio de la biblioteca',
        'Busca el ejercicio y selecciónalo de la lista. Si no existe, agrégalo a la biblioteca con el botón bajo el buscador.',
      );
      return;
    }
    setSaving(true);
    const seriesCount = parseInt(exSeries) || 3;
    // si el coach no tocó los campos de reps, se reescribe el objetivo original
    // sin pasarlo por el formulario: los campos son numéricos y un valor legado
    // ("al fallo") podría volver truncado desde el TextInput.
    const repsObjetivo = !repsTocadas && repsOriginal !== null
      ? repsOriginal
      : formatRepsRange(exRepsFrom, exRepsTo);

    // subir imagen de ejemplo si el coach eligió una nueva
    let imageUrl = exImageUrl;
    if (exNewImage) {
      try {
        imageUrl = await uploadMedia('exercise-media', `${user!.id}/ex-${Date.now()}.jpg`, exNewImage);
      } catch (e: any) {
        setSaving(false);
        showAlert('Error al subir imagen', e.message);
        return;
      }
    }

    // subir archivo de video si eligió uno (tiene prioridad sobre el link)
    let videoUrl = exVideoUrl.trim() || null;
    if (exNewVideo) {
      setUploadingVideo(true);
      try {
        videoUrl = await uploadMedia(
          'exercise-media',
          `${user!.id}/vid-${Date.now()}.${videoExtension(exNewVideo)}`,
          exNewVideo,
          'video',
        );
      } catch (e: any) {
        setSaving(false);
        setUploadingVideo(false);
        showAlert('Error al subir video', e.message);
        return;
      }
      setUploadingVideo(false);
    }

    const mediaFields = {
      notes: exNotes.trim() || null,
      video_url: videoUrl,
      image_url: imageUrl,
      muscle_group: exMuscle || null,
      name_en: exLibrary.name_en,
      library_id: exLibrary.library_id,
      tempo: exTempo.trim() || null,
      rest_seconds: exRest,
      target_rir: exTargetRir || null,
    };

    if (editingEx) {
      // el nombre no se actualiza: identifica al ejercicio y su historial
      const { data, error } = await supabase.from('exercises').update({
        reps_objective: repsObjetivo,
        unit: exUnit,
        ref_weight: exRefWeight ? parseFloat(exRefWeight) : null,
        // la agrupación se maneja desde la lista (⛓ UNIR / SACAR): editar otros
        // campos del ejercicio no debe pisar `superseries_group`
        ...mediaFields,
      }).eq('id', editingEx.id).select().single();

      if (error) {
        setSaving(false);
        showAlert('Error al guardar', error.message);
        return;
      }
      // sincronizar el número de series (nunca borra series con registros)
      const { data: existingSeries } = await supabase
        .from('exercise_series').select('id, series_number')
        .eq('exercise_id', editingEx.id).order('series_number');
      const current = existingSeries ?? [];
      if (seriesCount > current.length) {
        await supabase.from('exercise_series').insert(
          Array.from({ length: seriesCount - current.length }, (_, i) => ({
            exercise_id: editingEx.id, series_number: current.length + i + 1,
          }))
        );
      } else if (seriesCount < current.length) {
        const toRemove = current.slice(seriesCount);
        const { data: used } = await supabase
          .from('workout_logs').select('series_id').in('series_id', toRemove.map(s => s.id));
        const usedIds = new Set((used ?? []).map(l => l.series_id));
        const deletable = toRemove.filter(s => !usedIds.has(s.id));
        if (deletable.length > 0) {
          await supabase.from('exercise_series').delete().in('id', deletable.map(s => s.id));
        }
        if (deletable.length < toRemove.length) {
          showAlert(
            'Algunas series se conservaron',
            `${toRemove.length - deletable.length} serie(s) tienen entrenamientos registrados y no se eliminaron.`
          );
        }
      }

      if (data) {
        setDays(prev => prev.map(d => ({
          ...d,
          exercises: d.exercises.map(e => e.id === editingEx.id ? { ...e, ...data } : e)
        })));
      }
    } else {
      const day = days.find(d => d.id === targetDayId)!;
      const orderIndex = day.exercises.length;
      const { data: exData, error } = await supabase.from('exercises').insert({
        day_id: targetDayId,
        name: exName.trim(),
        reps_objective: repsObjetivo,
        unit: exUnit,
        ref_weight: exRefWeight ? parseFloat(exRefWeight) : null,
        // nace suelto: se encadena después desde la lista, con ⛓ UNIR.
        // Explícito para no depender del valor por omisión de la columna.
        superseries_group: null,
        order_index: orderIndex,
        ...mediaFields,
      }).select().single();

      if (error) {
        setSaving(false);
        showAlert('Error al guardar', error.message);
        return;
      }
      if (exData) {
        const seriesRows = Array.from({ length: seriesCount }, (_, i) => ({
          exercise_id: exData.id,
          series_number: i + 1,
        }));
        await supabase.from('exercise_series').insert(seriesRows);
        grupoEnBase.current.set(exData.id, exData.superseries_group ?? null);
        setDays(prev => prev.map(d =>
          d.id === targetDayId ? { ...d, exercises: [...d.exercises, exData] } : d
        ));
      }
    }
    setSuggestions([]);
    setShowExModal(false);
    setSaving(false);
  }

  async function moveExercise(dayId: string, index: number, dir: -1 | 1) {
    if (enVuelo.current) return; // hay una persistencia de grupos corriendo
    const day = days.find(d => d.id === dayId);
    if (!day) return;
    const j = index + dir;
    if (j < 0 || j >= day.exercises.length) return;
    const a = day.exercises[index];
    const b = day.exercises[j];
    setDays(prev => prev.map(d => {
      if (d.id !== dayId) return d;
      const list = [...d.exercises];
      [list[index], list[j]] = [list[j], list[index]];
      return { ...d, exercises: list };
    }));
    await conGuarda(async () => {
      // persistir usando las posiciones del array como orden canónico
      await supabase.from('exercises').update({ order_index: index }).eq('id', b.id);
      await supabase.from('exercises').update({ order_index: j }).eq('id', a.id);
      // mover rompe la adyacencia: un ejercicio suelto que cae en medio de una
      // biserie deja la misma etiqueta en posiciones no consecutivas (dos cajas
      // "BISERIE A" para el coach, ninguna para el alumno). Se re-normaliza y se
      // guarda la limpieza. `order_index` ya quedó escrito arriba y no se toca.
      const movida = [...day.exercises];
      [movida[index], movida[j]] = [movida[j], movida[index]];
      await persistirGrupos(dayId, normalizeGroups(encadenables(movida)));
    });
  }

  // `Exercise.superseries_group` es opcional (`string | null | undefined`) y las
  // funciones de superseries.ts piden `string | null`. Se normaliza acá, sin
  // tocar la lista ni su orden.
  type Encadenable = Exercise & { superseries_group: string | null };
  const encadenables = (list: Exercise[]): Encadenable[] =>
    list.map(e => ({ ...e, superseries_group: e.superseries_group ?? null }));

  // Encadenar no reordena: solo cambia `superseries_group` de los ejercicios
  // afectados. Por eso acá nunca se toca `order_index`.
  //
  // Qué filas se escriben se decide contra `grupoEnBase` —lo que hay guardado—
  // y no contra la lista en pantalla: al cargar se normaliza solo en memoria,
  // así que compararse con ese snapshot dejaba sin escribir justo las filas que
  // la normalización limpió. La letra se reciclaba sobre una etiqueta que
  // seguía viva en la base, y el alumno terminaba con una triserie que el coach
  // nunca armó. Así la limpieza viaja junto con la primera acción real del
  // coach: al cargar no se escribe nada, pero en cuanto encadena algo la base
  // queda igual a lo que él ve.
  async function persistirGrupos(dayId: string, despues: Encadenable[]) {
    // El orden de este lote importa y no es cosmético: primero las limpiezas
    // (`null`) y después las asignaciones. Escrito en el orden de la lista, una
    // etiqueta huérfana que quede DESPUÉS del par recién encadenado hace que la
    // base pase por un estado real de triserie ['A','A','A'] antes de
    // limpiarla; si justo esa última escritura falla, queda así, y un alumno
    // que cargue en esa ventana entrena algo que el coach nunca armó. Limpiando
    // primero, el peor caso deja MENOS ejercicios agrupados de los que
    // corresponde — el lado seguro. No reordenar esto.
    const cambiados = despues
      .filter(e => e.superseries_group !== (grupoEnBase.current.get(e.id) ?? null))
      .sort((a, b) => Number(a.superseries_group !== null) - Number(b.superseries_group !== null));
    setDays(prev => prev.map(d => (d.id === dayId ? { ...d, exercises: despues } : d)));
    for (const e of cambiados) {
      const { error } = await supabase
        .from('exercises')
        .update({ superseries_group: e.superseries_group })
        .eq('id', e.id);
      if (error) {
        // no se revierte a ciegas: acá pueden cambiar varias filas de una vez
        // (una triserie encadena tres) y, si el lote falla a la mitad, parte ya
        // quedó escrita. Volver al estado previo mostraría una agrupación que
        // la base no tiene, y dejar el estado optimista, una que sí tiene a
        // medias. Se recarga desde la base: lo que se ve es lo que hay guardado.
        showAlert('Error', 'No se pudo guardar la agrupación: ' + error.message);
        await fetchPlan();
        return;
      }
      grupoEnBase.current.set(e.id, e.superseries_group);
    }
  }

  // Guarda de concurrencia: mientras la operación esté viva, los handlers de
  // ⛓ UNIR / SACAR / ✕ y las flechas de reordenar ignoran los toques.
  async function conGuarda(operacion: () => Promise<void>) {
    const tarea = operacion();
    enVuelo.current = tarea;
    setOperando(true);
    try {
      await tarea;
    } finally {
      if (enVuelo.current === tarea) {
        enVuelo.current = null;
        setOperando(false);
      }
    }
  }

  async function persistGroups(dayId: string, despues: Encadenable[]) {
    await conGuarda(() => persistirGrupos(dayId, despues));
  }

  function chainExercise(dayId: string, exerciseId: string) {
    if (enVuelo.current) return;
    const day = days.find(d => d.id === dayId);
    if (!day) return;
    const lista = encadenables(day.exercises);
    persistGroups(dayId, chainWith(lista, exerciseId));
  }

  function unchainExercise(dayId: string, exerciseId: string) {
    if (enVuelo.current) return;
    const day = days.find(d => d.id === dayId);
    if (!day) return;
    const lista = encadenables(day.exercises);
    persistGroups(dayId, unchain(lista, exerciseId));
  }

  function dissolveExerciseGroup(dayId: string, label: string) {
    if (enVuelo.current) return;
    const day = days.find(d => d.id === dayId);
    if (!day) return;
    const lista = encadenables(day.exercises);
    persistGroups(dayId, dissolveGroup(lista, label));
  }

  function deleteExercise(ex: Exercise) {
    showConfirm('Eliminar ejercicio', `"${ex.name}" se quitará del plan. El historial del cliente se conserva.`, async () => {
      // archivado, no borrado: el historial del cliente queda intacto
      const { error } = await supabase.from('exercises').update({ archived: true }).eq('id', ex.id);
      if (error) {
        showAlert('Error', 'No se pudo eliminar el ejercicio: ' + error.message);
        return;
      }
      grupoEnBase.current.delete(ex.id);
      const day = days.find(d => d.id === ex.day_id);
      setDays(prev => prev.map(d => ({
        ...d,
        exercises: d.exercises.filter(e => e.id !== ex.id)
      })));
      // borrar es el productor principal de etiquetas huérfanas: sacar un
      // ejercicio de una biserie deja al superviviente con la etiqueta puesta
      // en la base. Se re-normaliza y se guarda la limpieza.
      if (day) {
        const restante = encadenables(day.exercises.filter(e => e.id !== ex.id));
        await persistGroups(day.id, normalizeGroups(restante));
      }
    }, 'Eliminar');
  }

  if (loading) return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.accent} style={{ marginTop: 100 }} />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← ATRÁS</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerLabel}>{weekLabel ? weekLabel.toUpperCase() : 'PLAN DE'}</Text>
          <Text style={styles.headerName}>{client.name.toUpperCase()}</Text>
        </View>
        <TouchableOpacity style={styles.addDayBtn} onPress={() => setShowDayModal(true)}>
          <Text style={styles.addDayBtnText}>+ DÍA</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {days.length === 0 && (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>SIN DÍAS AÚN</Text>
            <Text style={styles.emptyText}>Toca "+ DÍA" para crear el primer día de entrenamiento.</Text>
          </Card>
        )}

        {days.map(day => (
          <View key={day.id} style={styles.dayBlock}>
            <View style={styles.dayHeader}>
              <View style={styles.dayHeaderLeft}>
                <View style={styles.weekDayBadge}>
                  <Text style={styles.weekDayText}>
                    {day.week_day != null ? WEEK_DAYS[day.week_day] : `D${day.day_number}`}
                  </Text>
                </View>
                <Text style={styles.dayName}>{day.name.toUpperCase()}</Text>
              </View>
              <View style={styles.dayHeaderActions}>
                <TouchableOpacity onPress={() => saveDayAsTemplate(day)} style={styles.iconBtn}>
                  <Ionicons name="bookmark-outline" size={13} color={colors.accent} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openAddExercise(day.id)} style={styles.iconBtn}>
                  <Text style={styles.iconBtnText}>+ EJ.</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteDay(day.id)} style={styles.iconBtnDanger}>
                  <Text style={styles.iconBtnDangerText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {day.exercises.map((ex, idx) => (
              <React.Fragment key={ex.id}>
                {(() => {
                  if (idx === 0) return null;
                  const anterior = day.exercises[idx - 1];
                  const mismoGrupo =
                    !!ex.superseries_group && ex.superseries_group === anterior.superseries_group;
                  if (mismoGrupo) return null;
                  return (
                    <TouchableOpacity
                      style={operando ? [styles.chainBtn, styles.controlInactivo] : styles.chainBtn}
                      onPress={() => chainExercise(day.id, ex.id)}
                      disabled={operando}
                      hitSlop={{ top: 8, bottom: 8, left: 20, right: 20 }}
                    >
                      <View style={styles.chainLine} />
                      <Text style={styles.chainText}>⛓ UNIR</Text>
                      <View style={styles.chainLine} />
                    </TouchableOpacity>
                  );
                })()}
                <Card
                  style={ex.superseries_group
                    ? {
                        ...styles.exCard,
                        borderColor: colorForLabel(ex.superseries_group),
                        borderWidth: 1.5,
                      }
                    : styles.exCard}
                >
                <View style={styles.exRow}>
                  <View style={styles.reorderCol}>
                    <TouchableOpacity
                      onPress={() => moveExercise(day.id, idx, -1)}
                      disabled={operando || idx === 0}
                      style={operando ? [styles.reorderBtn, styles.controlInactivo] : styles.reorderBtn}
                      hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
                    >
                      <Ionicons name="chevron-up" size={15} color={idx === 0 ? colors.border : colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => moveExercise(day.id, idx, 1)}
                      disabled={operando || idx === day.exercises.length - 1}
                      style={operando ? [styles.reorderBtn, styles.controlInactivo] : styles.reorderBtn}
                      hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
                    >
                      <Ionicons name="chevron-down" size={15} color={idx === day.exercises.length - 1 ? colors.border : colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  {ex.image_url ? (
                    <Image source={{ uri: ex.image_url }} style={styles.exThumb} />
                  ) : null}
                  <View style={styles.exInfo}>
                    {ex.superseries_group && (
                      <View style={styles.superRow}>
                        {/* tocar la etiqueta deshace el grupo entero; "SACAR"
                            saca solo este ejercicio */}
                        <TouchableOpacity
                          onPress={() => dissolveExerciseGroup(day.id, ex.superseries_group!)}
                          disabled={operando}
                          // 16 arriba y abajo, no 12: la píldora mide ~15pt de
                          // alto y el hitSlop es lo único que la lleva a 44pt
                          hitSlop={{ top: 16, bottom: 16, left: 8, right: 8 }}
                          style={[
                            styles.superTag,
                            { backgroundColor: colorForLabel(ex.superseries_group) },
                            operando && styles.controlInactivo,
                          ]}
                        >
                          <Text style={styles.superTagText}>
                            ⛓ {groupNameFor(
                              day.exercises.filter(e => e.superseries_group === ex.superseries_group).length,
                              ex.superseries_group,
                            )} ✕
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => unchainExercise(day.id, ex.id)}
                          disabled={operando}
                          style={operando ? styles.controlInactivo : undefined}
                          // ídem: el texto mide ~11pt, con 18 de hitSlop llega a 44pt
                          hitSlop={{ top: 18, bottom: 18, left: 12, right: 12 }}
                        >
                          <Text style={styles.superUnchain}>SACAR</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    <Text style={styles.exName}>{ex.name}</Text>
                    <Text style={styles.exMeta}>
                      {ex.muscle_group ? `${ex.muscle_group} · ` : ''}{ex.reps_objective} reps · {ex.unit}
                      {ex.ref_weight ? ` · ref ${ex.ref_weight}${ex.unit}` : ''}
                      {ex.video_url ? ' · 🎬' : ''}
                    </Text>
                  </View>
                  <View style={styles.exActions}>
                    <TouchableOpacity onPress={() => openEditExercise(ex)} style={styles.editBtn}>
                      <Ionicons name="pencil" size={14} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteExercise(ex)} style={styles.deleteBtn}>
                      <Ionicons name="close" size={14} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
                </Card>
              </React.Fragment>
            ))}

            {day.exercises.length === 0 && (
              <TouchableOpacity style={styles.addFirstEx} onPress={() => openAddExercise(day.id)}>
                <Text style={styles.addFirstExText}>+ Agregar primer ejercicio</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Modal: nuevo día */}
      <Modal visible={showDayModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>NUEVO DÍA</Text>

            <Text style={styles.inputLabel}>NOMBRE DEL DÍA</Text>
            <TextInput
              style={styles.input}
              value={newDayName}
              onChangeText={setNewDayName}
              placeholder="ej: Torso, Pierna, Full body"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />

            <Text style={styles.inputLabel}>DÍA DE LA SEMANA</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekDayPicker}>
              {WEEK_DAYS.map((d, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.weekDayOption, newDayWeekDay === i && styles.weekDayOptionActive]}
                  onPress={() => setNewDayWeekDay(i)}
                >
                  <Text style={[styles.weekDayOptionText, newDayWeekDay === i && styles.weekDayOptionTextActive]}>
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {templates.length > 0 && (
              <>
                <Text style={styles.inputLabel}>O CREAR DESDE PLANTILLA</Text>
                <View style={styles.templateList}>
                  {templates.map(tpl => (
                    <TouchableOpacity key={tpl.id} style={styles.templateRow} onPress={() => addDayFromTemplate(tpl)} disabled={saving}>
                      <Ionicons name="bookmark" size={14} color={colors.accent} />
                      <Text style={styles.templateName} numberOfLines={1}>{tpl.name}</Text>
                      <Text style={styles.templateCount}>{tpl.exercises.length} ej.</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowDayModal(false)}>
                <Text style={styles.cancelBtnText}>CANCELAR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={addDay} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.background} size="small" />
                  : <Text style={styles.confirmBtnText}>AGREGAR</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: ejercicio */}
      <Modal visible={showExModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {editingEx ? 'EDITAR EJERCICIO' : 'NUEVO EJERCICIO'}
            </Text>

            <Text style={styles.inputLabel}>EJERCICIO</Text>
            {editingEx ? (
              <>
                <View style={styles.lockedName}>
                  <Text style={styles.lockedNameText} numberOfLines={1}>{exName}</Text>
                  <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
                </View>
                <Text style={styles.lockHint}>
                  El nombre identifica el historial del cliente. Para cambiar el ejercicio, elimínalo y agrega otro de la biblioteca.
                </Text>
              </>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  value={exName}
                  onChangeText={onExNameChange}
                  placeholder="Busca en la biblioteca: press, remo, sentadilla..."
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                />
                {suggestions.length > 0 && (
                  <View style={styles.suggestBox}>
                    {suggestions.map(s => (
                      <TouchableOpacity key={s.name} style={styles.suggestRow} onPress={() => pickSuggestion(s)}>
                        <View style={styles.suggestInfo}>
                          <Text style={styles.suggestName} numberOfLines={1}>{s.name}</Text>
                          <Text style={styles.suggestMeta} numberOfLines={1}>
                            {s.muscle_group}{s.equipment ? ` · ${s.equipment}` : ''}
                          </Text>
                        </View>
                        <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {exLibrary.library_id ? (
                  <View style={styles.pickedRow}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                    <Text style={styles.pickedText}>
                      De la biblioteca{exLibrary.name_en ? ` · ${exLibrary.name_en}` : ''}
                    </Text>
                  </View>
                ) : exName.trim().length >= 3 ? (
                  <>
                    {!showLibForm ? (
                      <TouchableOpacity style={styles.addLibBtn} onPress={() => setShowLibForm(true)}>
                        <Ionicons name="library-outline" size={15} color={colors.accent} />
                        <Text style={styles.addLibText}>¿No está? Agregar "{exName.trim()}" a la biblioteca</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.libForm}>
                        <Text style={styles.libFormTitle}>NUEVO EN LA BIBLIOTECA</Text>
                        <TextInput
                          style={styles.input}
                          value={libNameEn}
                          onChangeText={setLibNameEn}
                          placeholder="Nombre en inglés (opcional)"
                          placeholderTextColor={colors.textMuted}
                        />
                        <TextInput
                          style={styles.input}
                          value={libEquipment}
                          onChangeText={setLibEquipment}
                          placeholder="Equipo (opcional): barra, mancuerna, máquina..."
                          placeholderTextColor={colors.textMuted}
                        />
                        <Text style={styles.libFormHint}>Elige también el grupo muscular más abajo.</Text>
                        <TouchableOpacity style={styles.libFormBtn} onPress={addToLibrary} disabled={libSaving}>
                          <Text style={styles.libFormBtnText}>{libSaving ? 'AGREGANDO...' : 'AGREGAR A BIBLIOTECA'}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                ) : null}
              </>
            )}

            <Text style={styles.inputLabel}>GRUPO MUSCULAR</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.repsPicker}>
              {MUSCLE_GROUPS.map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.repsOption, exMuscle === g && styles.repsOptionActive]}
                  onPress={() => setExMuscle(exMuscle === g ? '' : g)}
                >
                  <Text style={[styles.repsOptionText, exMuscle === g && styles.repsOptionTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>OBJETIVO DE REPS</Text>
            <View style={styles.repsRow}>
              <TextInput
                style={styles.repsInput}
                value={exRepsFrom}
                onChangeText={v => { setExRepsFrom(v); setRepsTocadas(true); }}
                keyboardType="number-pad"
                placeholder="desde"
                placeholderTextColor={colors.textMuted}
                // 24 y no 3: acá también cae el objetivo legado escrito a mano
                // ("al fallo"), y en iOS `maxLength` recorta el valor puesto por
                // JS, no solo lo que se teclea.
                maxLength={24}
              />
              <Text style={styles.repsDash}>a</Text>
              <TextInput
                style={styles.repsInput}
                value={exRepsTo}
                onChangeText={v => { setExRepsTo(v); setRepsTocadas(true); }}
                keyboardType="number-pad"
                placeholder="hasta"
                placeholderTextColor={colors.textMuted}
                maxLength={24}
              />
            </View>

            <Text style={styles.inputLabel}>UNIDAD</Text>
            <View style={styles.unitPicker}>
              {(['kg', 'lb'] as const).map(u => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitOption, exUnit === u && styles.unitOptionActive]}
                  onPress={() => setExUnit(u)}
                >
                  <Text style={[styles.unitOptionText, exUnit === u && styles.unitOptionTextActive]}>
                    {u.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>PESO DE REFERENCIA (opcional)</Text>
            <TextInput
              style={styles.input}
              value={exRefWeight}
              onChangeText={setExRefWeight}
              placeholder={`ej: 20 ${exUnit}`}
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
            />

            <Text style={styles.inputLabel}>TEMPO (opcional, ej: 3-0-1)</Text>
            <TextInput
              style={styles.input}
              value={exTempo}
              onChangeText={setExTempo}
              placeholder="excéntrica-pausa-concéntrica"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>DESCANSO ENTRE SERIES (opcional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.repsPicker}>
              {REST_OPTIONS.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.repsOption, exRest === s && styles.repsOptionActive]}
                  onPress={() => setExRest(exRest === s ? null : s)}
                >
                  <Text style={[styles.repsOptionText, exRest === s && styles.repsOptionTextActive]}>
                    {s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>RIR OBJETIVO (opcional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.repsPicker}>
              {RIR_OPTIONS.map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.repsOption, exTargetRir === r && styles.repsOptionActive]}
                  onPress={() => setExTargetRir(exTargetRir === r ? '' : r)}
                >
                  <Text style={[styles.repsOptionText, exTargetRir === r && styles.repsOptionTextActive]}>RIR {r}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>IMAGEN DE EJEMPLO (opcional)</Text>
            <TouchableOpacity style={styles.imagePicker} onPress={chooseImage} activeOpacity={0.8}>
              {exNewImage || exImageUrl ? (
                <Image
                  source={{ uri: exNewImage?.uri ?? exImageUrl! }}
                  style={styles.imagePreview}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="image-outline" size={28} color={colors.textMuted} />
                  <Text style={styles.imagePlaceholderText}>Toca para elegir una foto del ejercicio</Text>
                </View>
              )}
            </TouchableOpacity>
            {(exNewImage || exImageUrl) && (
              <TouchableOpacity onPress={() => { setExNewImage(null); setExImageUrl(null); }}>
                <Text style={styles.removeImageText}>Quitar imagen</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.inputLabel}>VIDEO DE EJEMPLO (opcional)</Text>
            {exNewVideo ? (
              <View style={styles.videoChip}>
                <Ionicons name="videocam" size={18} color={colors.accent} />
                <Text style={styles.videoChipText} numberOfLines={1}>
                  {exNewVideo.fileName ?? 'Video seleccionado'}
                  {exNewVideo.duration ? ` · ${Math.round(exNewVideo.duration / 1000)}s` : ''}
                </Text>
                <TouchableOpacity onPress={() => setExNewVideo(null)}>
                  <Ionicons name="close-circle" size={18} color={colors.danger} />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TouchableOpacity style={styles.uploadVideoBtn} onPress={chooseVideo} activeOpacity={0.8}>
                  <Ionicons name="cloud-upload-outline" size={18} color={colors.accent} />
                  <Text style={styles.uploadVideoText}>SUBIR VIDEO (máx 50MB)</Text>
                </TouchableOpacity>
                <Text style={styles.orText}>— o pega un link de YouTube —</Text>
                <TextInput
                  style={styles.input}
                  value={exVideoUrl}
                  onChangeText={setExVideoUrl}
                  placeholder="ej: https://youtube.com/watch?v=..."
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </>
            )}

            <Text style={styles.inputLabel}>INSTRUCCIONES / NOTAS (opcional)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={exNotes}
              onChangeText={setExNotes}
              placeholder="ej: Baja controlado 3 segundos, codos a 45°..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.inputLabel}>NÚMERO DE SERIES</Text>
            <View style={styles.unitPicker}>
              {['1', '2', '3', '4', '5'].map(n => (
                <TouchableOpacity
                  key={n}
                  style={[styles.unitOption, exSeries === n && styles.unitOptionActive]}
                  onPress={() => setExSeries(n)}
                >
                  <Text style={[styles.unitOptionText, exSeries === n && styles.unitOptionTextActive]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowExModal(false)}>
                <Text style={styles.cancelBtnText}>CANCELAR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={saveExercise} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.background} size="small" />
                  : <Text style={styles.confirmBtnText}>GUARDAR</Text>}
              </TouchableOpacity>
            </View>
            {uploadingVideo && (
              <Text style={styles.uploadingText}>Subiendo video… esto puede tardar unos segundos</Text>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingHorizontal: spacing.xl, marginBottom: spacing.lg,
  },
  backText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
  headerLabel: { ...typography.caption, letterSpacing: 3, color: colors.textMuted },
  headerName: { ...typography.displaySm },
  addDayBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  addDayBtnText: { color: colors.background, fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.lg },
  emptyCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyTitle: { ...typography.h3, color: colors.textMuted },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },

  dayBlock: { gap: spacing.sm },
  dayHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  dayHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  weekDayBadge: {
    backgroundColor: colors.accent, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  weekDayText: { color: colors.background, fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  dayName: { ...typography.h3 },
  dayHeaderActions: { flexDirection: 'row', gap: spacing.sm },
  iconBtn: {
    backgroundColor: colors.surface, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  iconBtnText: { ...typography.caption, color: colors.accent, letterSpacing: 1 },
  iconBtnDanger: {
    backgroundColor: colors.surface, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.danger,
  },
  iconBtnDangerText: { ...typography.caption, color: colors.danger },

  exCard: { },
  exRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  exThumb: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surface },
  templateList: { gap: spacing.xs },
  templateRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
  },
  templateName: { ...typography.body, fontSize: 14, fontWeight: '600', flex: 1 },
  templateCount: { ...typography.caption, fontSize: 10 },
  suggestBox: {
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.accent + '44',
    marginTop: -spacing.sm,
  },
  suggestRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  suggestInfo: { flex: 1 },
  suggestName: { ...typography.body, fontSize: 14, fontWeight: '600' },
  suggestMeta: { ...typography.caption, fontSize: 10, marginTop: 1 },
  reorderCol: { justifyContent: 'center', gap: 2 },
  reorderBtn: { padding: 2 },
  exInfo: { flex: 1 },
  superRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 3 },
  superTag: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  superTagText: { fontSize: 8, fontWeight: '900', letterSpacing: 1, color: colors.background },
  superUnchain: { fontSize: 8, fontWeight: '800', letterSpacing: 1, color: colors.textMuted },
  // el minHeight va en el propio TouchableOpacity: en React Native el padding
  // del contenedor padre no amplía el área táctil de un hijo
  chainBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    minHeight: 44, paddingHorizontal: spacing.md,
  },
  chainLine: { flex: 1, height: 1, backgroundColor: colors.border },
  chainText: { fontSize: 9, letterSpacing: 1.5, fontWeight: '800', color: colors.textMuted },
  // se aplica mientras hay una agrupación guardándose: los controles quedan
  // inactivos y tienen que verse inactivos, si no el coach toca y cree que el
  // botón está roto. Solo opacidad: nada de spinners ni cambios de layout.
  controlInactivo: { opacity: 0.4 },
  exName: { ...typography.h3 },
  lockedName: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  lockedNameText: { ...typography.h3, fontSize: 15, flex: 1 },
  lockHint: { ...typography.caption, fontSize: 10, fontStyle: 'italic', marginTop: spacing.xs },
  pickedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  pickedText: { ...typography.caption, fontSize: 11, color: colors.success },
  addLibBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    marginTop: spacing.xs, paddingVertical: spacing.xs,
  },
  addLibText: { ...typography.caption, fontSize: 11, color: colors.accent, flex: 1 },
  libForm: {
    gap: spacing.sm, marginTop: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.accent + '44', padding: spacing.md,
  },
  libFormTitle: { ...typography.label, fontSize: 10, color: colors.accent, letterSpacing: 1.5 },
  libFormHint: { ...typography.caption, fontSize: 10, fontStyle: 'italic' },
  libFormBtn: {
    backgroundColor: colors.accent, borderRadius: radius.sm,
    alignItems: 'center', paddingVertical: spacing.sm + 2,
  },
  libFormBtnText: { color: colors.background, fontWeight: '900', fontSize: 11, letterSpacing: 1.5 },
  exMeta: { ...typography.caption, marginTop: 2 },
  exActions: { flexDirection: 'row', gap: spacing.sm },
  editBtn: {
    width: 32, height: 32, borderRadius: radius.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  editBtnText: { fontSize: 14 },
  deleteBtn: {
    width: 32, height: 32, borderRadius: radius.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.danger,
    alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 12, color: colors.danger },
  addFirstEx: {
    paddingVertical: spacing.sm, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
    borderRadius: radius.md,
  },
  addFirstExText: { ...typography.caption, color: colors.accent, letterSpacing: 1 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalScroll: { maxHeight: '90%', flexGrow: 0 },
  modalBox: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.lg * 2,
    borderTopRightRadius: radius.lg * 2, padding: spacing.xl,
    gap: spacing.md, paddingBottom: spacing.xxl,
  },
  modalTitle: { ...typography.h2, marginBottom: spacing.sm },
  inputLabel: { ...typography.label, letterSpacing: 2, marginBottom: -spacing.sm },
  input: {
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    color: colors.textPrimary, fontSize: 15,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  imagePicker: {
    borderRadius: radius.md, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  imagePreview: { width: '100%', height: 160 },
  imagePlaceholder: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  imagePlaceholderText: { ...typography.caption },
  removeImageText: {
    ...typography.caption, color: colors.danger,
    textAlign: 'center', letterSpacing: 1,
  },
  uploadVideoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.accent + '66',
    backgroundColor: colors.card, paddingVertical: spacing.md,
  },
  uploadVideoText: { ...typography.label, color: colors.accent, letterSpacing: 1.5 },
  orText: { ...typography.caption, textAlign: 'center', fontSize: 10 },
  videoChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card, padding: spacing.md,
  },
  videoChipText: { ...typography.caption, color: colors.textPrimary, flex: 1 },
  uploadingText: { ...typography.caption, color: colors.accent, textAlign: 'center' },
  weekDayPicker: { flexGrow: 0 },
  weekDayOption: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    marginRight: spacing.sm, backgroundColor: colors.card,
  },
  weekDayOptionActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  weekDayOptionText: { ...typography.caption, color: colors.textMuted, fontWeight: '700' },
  weekDayOptionTextActive: { color: colors.background },
  repsPicker: { flexGrow: 0 },
  repsOption: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    marginRight: spacing.sm, backgroundColor: colors.card,
  },
  repsOptionActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  repsOptionText: { ...typography.caption, color: colors.textMuted, fontWeight: '700' },
  repsOptionTextActive: { color: colors.background },
  repsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  repsInput: {
    // colors.card (no surface) porque el modal ya es surface: el campo tiene
    // que despegarse del fondo, igual que el resto de los inputs
    flex: 1, backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: spacing.md - 4, paddingHorizontal: spacing.md,
    fontSize: 15, color: colors.textPrimary, textAlign: 'center',
    minHeight: 44, // área táctil real del campo, no la del contenedor
  },
  repsDash: { fontSize: 11, color: colors.textMuted },
  unitPicker: { flexDirection: 'row', gap: spacing.sm },
  unitOption: {
    flex: 1, paddingVertical: spacing.sm, alignItems: 'center',
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  unitOptionActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  unitOptionText: { ...typography.label, letterSpacing: 1 },
  unitOptionTextActive: { color: colors.background },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  cancelBtn: {
    flex: 1, paddingVertical: spacing.md, alignItems: 'center',
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  cancelBtnText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
  confirmBtn: {
    flex: 1, paddingVertical: spacing.md, alignItems: 'center',
    borderRadius: radius.md, backgroundColor: colors.accent,
  },
  confirmBtnText: { color: colors.background, fontWeight: '900', fontSize: 13, letterSpacing: 2 },
});
