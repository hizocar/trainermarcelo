import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Modal,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';
import { showAlert, showConfirm } from '../../lib/alert';
import { WEEK_DAYS_SHORT as WEEK_DAYS } from '../../lib/weeks';
import { parseRepsRange, formatRepsRange } from '../../lib/reps';
import {
  chainWith, unchain, dissolveGroup, groupNameFor, colorForLabel, normalizeGroups,
} from '../../lib/superseries';

// Editor de un Programa (plantilla sin cliente asignado): mismo modelo de
// edición que PlanEditorScreen, pero sobre program_template_* — y sin
// archivar, un programa no tiene historial de nadie todavía, así que
// quitar algo acá lo borra de verdad. Ver también TemplateEditor.tsx (web),
// que cubre exactamente el mismo alcance.

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

interface TplExercise {
  id: string; day_id: string; name: string; name_en: string | null; library_id: string | null;
  muscle_group: string | null; superseries_group: string | null;
  reps_objective: string; unit: 'kg' | 'lb'; ref_weight: number | null;
  order_index: number; tempo: string | null; rest_seconds: number | null; target_rir: string | null;
  notes: string | null;
}
interface TplDay { id: string; template_id: string; day_number: number; name: string; week_day: number | null; exercises: TplExercise[] }

type RouteParams = { templateId: string; name: string };

export default function ProgramEditorScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { templateId, name: initialName } = route.params as RouteParams;
  const { user } = useAuth();

  const [name, setName] = useState(initialName);
  const [durationWeeks, setDurationWeeks] = useState('');
  const [days, setDays] = useState<TplDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showDayModal, setShowDayModal] = useState(false);
  const [newDayName, setNewDayName] = useState('');
  const [newDayWeekDay, setNewDayWeekDay] = useState<number | null>(null);

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
  const [editingEx, setEditingEx] = useState<TplExercise | null>(null);
  const [suggestions, setSuggestions] = useState<{ id: string; name: string; name_en: string | null; muscle_group: string; equipment: string | null }[]>([]);
  const [exLibrary, setExLibrary] = useState<{ name_en: string | null; library_id: string | null }>({ name_en: null, library_id: null });
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

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);

  useEffect(() => { fetchTemplate(); }, []);

  async function fetchTemplate() {
    const { data: tpl } = await supabase
      .from('program_templates').select('name, duration_weeks').eq('id', templateId).maybeSingle();
    if (tpl) {
      setName(tpl.name);
      setDurationWeeks(tpl.duration_weeks != null ? String(tpl.duration_weeks) : '');
    }
    const { data: daysData } = await supabase
      .from('program_template_days').select('*').eq('template_id', templateId).order('day_number');
    const daysWithEx: TplDay[] = [];
    // se guarda la lista CRUDA (antes de normalizar) en `grupoEnBase`: es lo
    // que hay realmente en la base, y contra eso compara `persistGroups`.
    const base = new Map<string, string | null>();
    for (const d of (daysData ?? [])) {
      const { data: exData } = await supabase
        .from('program_template_exercises').select('*').eq('day_id', d.id).order('order_index');
      for (const e of ((exData ?? []) as TplExercise[])) {
        base.set(e.id, e.superseries_group ?? null);
      }
      // se normaliza solo lo que se muestra: una etiqueta huérfana —de un
      // guardado que quedó a medias, o de programas viejos— dibujaría una
      // píldora de grupo sobre un ejercicio suelto. No se escribe nada al
      // cargar: reescribir los datos del coach a sus espaldas sería peor
      // que el bug. La limpieza se guarda junto con la primera acción real
      // del coach.
      daysWithEx.push({ ...d, exercises: normalizeGroups(exData ?? []) });
    }
    grupoEnBase.current = base;
    setDays(daysWithEx);
    setLoading(false);
  }

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed) { setName(initialName); return; }
    await supabase.from('program_templates').update({ name: trimmed }).eq('id', templateId);
  }

  async function saveDuration() {
    const trimmed = durationWeeks.trim();
    const parsed = trimmed === '' ? null : parseInt(trimmed, 10);
    if (parsed != null && (isNaN(parsed) || parsed < 1 || parsed > 52)) { setDurationWeeks(''); return; }
    await supabase.from('program_templates').update({ duration_weeks: parsed }).eq('id', templateId);
  }

  function openNewDay() {
    // Sugerencia: el próximo día de semana libre (Lun..Dom) para que el
    // split quede distribuido automáticamente en vez de partir sin fecha.
    const used = new Set(days.map(d => d.week_day).filter((v): v is number => v != null));
    const order = [1, 2, 3, 4, 5, 6, 0];
    const suggested = order.find(v => !used.has(v)) ?? null;
    setNewDayName('');
    setNewDayWeekDay(suggested);
    setShowDayModal(true);
  }

  async function addDay() {
    if (!newDayName.trim()) return;
    setSaving(true);
    const dayNumber = days.length + 1;
    const { data, error } = await supabase
      .from('program_template_days')
      .insert({ template_id: templateId, day_number: dayNumber, name: newDayName.trim(), week_day: newDayWeekDay })
      .select().single();
    if (!error && data) setDays(prev => [...prev, { ...data, exercises: [] }]);
    setShowDayModal(false);
    setSaving(false);
  }

  function deleteDay(dayId: string) {
    showConfirm('Quitar día', 'Se quitará del programa (esto sí lo borra — un programa todavía no tiene historial de nadie).', async () => {
      // se borra explícito en cascada (series → ejercicios → día) por si la
      // FK no tiene ON DELETE CASCADE configurado
      const day = days.find(d => d.id === dayId);
      const exIds = (day?.exercises ?? []).map(e => e.id);
      if (exIds.length > 0) {
        await supabase.from('program_template_series').delete().in('exercise_id', exIds);
        await supabase.from('program_template_exercises').delete().in('id', exIds);
      }
      await supabase.from('program_template_days').delete().eq('id', dayId);
      setDays(prev => prev.filter(d => d.id !== dayId));
    }, 'Quitar');
  }

  function openAddExercise(dayId: string) {
    setTargetDayId(dayId);
    setExName(''); setExRepsFrom(''); setExRepsTo(''); setExUnit('kg');
    setRepsOriginal(null); setRepsTocadas(false);
    setExRefWeight(''); setExSeries('3');
    setExNotes(''); setExMuscle('');
    setExTempo(''); setExRest(null); setExTargetRir('');
    setExLibrary({ name_en: null, library_id: null });
    setEditingEx(null);
    setShowExModal(true);
  }

  function openEditExercise(ex: TplExercise) {
    setTargetDayId(ex.day_id);
    setExSeries('3'); // el número real de series se sincroniza al guardar
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
    setEditingEx(ex);
    (async () => {
      const { count } = await supabase
        .from('program_template_series').select('*', { count: 'exact', head: true }).eq('exercise_id', ex.id);
      setExSeries(String(count ?? 3));
    })();
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
      setSuggestions((data ?? []).filter(s => s.name.toLowerCase() !== q.toLowerCase()));
    }, 250);
  }

  function pickSuggestion(s: { id: string; name: string; name_en: string | null; muscle_group: string }) {
    setExName(s.name);
    setExMuscle(s.muscle_group);
    setExLibrary({ name_en: s.name_en, library_id: s.id });
    setSuggestions([]);
  }

  async function saveExercise() {
    if (!exName.trim()) return;
    if (!editingEx && !exLibrary.library_id) {
      showAlert('Elige un ejercicio de la biblioteca', 'Busca el ejercicio y selecciónalo de la lista.');
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
    const fields = {
      notes: exNotes.trim() || null,
      muscle_group: exMuscle || null,
      name_en: exLibrary.name_en,
      library_id: exLibrary.library_id,
      tempo: exTempo.trim() || null,
      rest_seconds: exRest,
      target_rir: exTargetRir || null,
      reps_objective: repsObjetivo,
      unit: exUnit,
      ref_weight: exRefWeight ? parseFloat(exRefWeight) : null,
    };

    if (editingEx) {
      // la agrupación se maneja desde la lista (⛓ UNIR / SACAR): editar otros
      // campos del ejercicio no debe pisar `superseries_group`
      const { data, error } = await supabase.from('program_template_exercises')
        .update(fields).eq('id', editingEx.id).select().single();
      if (error) { setSaving(false); showAlert('Error al guardar', error.message); return; }

      const { data: existingSeries } = await supabase
        .from('program_template_series').select('id, series_number').eq('exercise_id', editingEx.id).order('series_number');
      const current = existingSeries ?? [];
      if (seriesCount > current.length) {
        await supabase.from('program_template_series').insert(
          Array.from({ length: seriesCount - current.length }, (_, i) => ({
            exercise_id: editingEx.id, series_number: current.length + i + 1,
          }))
        );
      } else if (seriesCount < current.length) {
        const toRemove = current.slice(seriesCount);
        await supabase.from('program_template_series').delete().in('id', toRemove.map(s => s.id));
      }

      if (data) {
        setDays(prev => prev.map(d => ({
          ...d, exercises: d.exercises.map(e => e.id === editingEx.id ? { ...e, ...data } : e),
        })));
      }
    } else {
      const day = days.find(d => d.id === targetDayId)!;
      const orderIndex = day.exercises.length;
      const { data: exData, error } = await supabase.from('program_template_exercises').insert({
        day_id: targetDayId, name: exName.trim(), order_index: orderIndex,
        // nace suelto: se encadena después desde la lista, con ⛓ UNIR.
        // Explícito para no depender del valor por omisión de la columna.
        superseries_group: null,
        ...fields,
      }).select().single();
      if (error) { setSaving(false); showAlert('Error al guardar', error.message); return; }
      if (exData) {
        await supabase.from('program_template_series').insert(
          Array.from({ length: seriesCount }, (_, i) => ({ exercise_id: exData.id, series_number: i + 1 })),
        );
        grupoEnBase.current.set(exData.id, exData.superseries_group ?? null);
        setDays(prev => prev.map(d => d.id === targetDayId ? { ...d, exercises: [...d.exercises, exData] } : d));
      }
    }
    setSuggestions([]);
    setShowExModal(false);
    setSaving(false);
  }

  function deleteExercise(ex: TplExercise) {
    showConfirm('Quitar ejercicio', `"${ex.name}" se quitará del programa.`, async () => {
      const { error } = await supabase.from('program_template_exercises').delete().eq('id', ex.id);
      if (error) {
        showAlert('Error', 'No se pudo quitar el ejercicio: ' + error.message);
        return;
      }
      grupoEnBase.current.delete(ex.id);
      const day = days.find(d => d.id === ex.day_id);
      setDays(prev => prev.map(d => ({ ...d, exercises: d.exercises.filter(e => e.id !== ex.id) })));
      // quitar es el productor principal de etiquetas huérfanas: sacar un
      // ejercicio de una biserie deja al superviviente con la etiqueta puesta
      // en la base. Se re-normaliza y se guarda la limpieza.
      if (day) {
        const restante = day.exercises.filter(e => e.id !== ex.id);
        await persistGroups(day.id, normalizeGroups(restante));
      }
    }, 'Quitar');
  }

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
  async function persistirGrupos(dayId: string, despues: TplExercise[]) {
    // El orden de este lote importa y no es cosmético: primero las limpiezas
    // (`null`) y después las asignaciones. Escrito en el orden de la lista, una
    // etiqueta huérfana que quede DESPUÉS del par recién encadenado hace que la
    // base pase por un estado real de triserie ['A','A','A'] antes de
    // limpiarla; si justo esa última escritura falla, queda así, y el programa
    // se asigna con una agrupación que el coach nunca armó. Limpiando primero,
    // el peor caso deja MENOS ejercicios agrupados de los que corresponde — el
    // lado seguro. No reordenar esto.
    const cambiados = despues
      .filter(e => e.superseries_group !== (grupoEnBase.current.get(e.id) ?? null))
      .sort((a, b) => Number(a.superseries_group !== null) - Number(b.superseries_group !== null));
    setDays(prev => prev.map(d => (d.id === dayId ? { ...d, exercises: despues } : d)));
    for (const e of cambiados) {
      const { error } = await supabase
        .from('program_template_exercises')
        .update({ superseries_group: e.superseries_group })
        .eq('id', e.id);
      if (error) {
        // no se revierte a ciegas: acá pueden cambiar varias filas de una vez
        // (una triserie encadena tres) y, si el lote falla a la mitad, parte ya
        // quedó escrita. Volver al estado previo mostraría una agrupación que
        // la base no tiene, y dejar el estado optimista, una que sí tiene a
        // medias. Se recarga desde la base: lo que se ve es lo que hay guardado.
        showAlert('Error', 'No se pudo guardar la agrupación: ' + error.message);
        await fetchTemplate();
        return;
      }
      grupoEnBase.current.set(e.id, e.superseries_group);
    }
  }

  // Envoltorio con la guarda de concurrencia: mientras esta promesa esté viva,
  // los handlers de ⛓ UNIR / SACAR / ✕ ignoran los toques.
  async function persistGroups(dayId: string, despues: TplExercise[]) {
    const tarea = persistirGrupos(dayId, despues);
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

  function chainExercise(dayId: string, exerciseId: string) {
    if (enVuelo.current) return;
    const day = days.find(d => d.id === dayId);
    if (!day) return;
    persistGroups(dayId, chainWith(day.exercises, exerciseId));
  }

  function unchainExercise(dayId: string, exerciseId: string) {
    if (enVuelo.current) return;
    const day = days.find(d => d.id === dayId);
    if (!day) return;
    persistGroups(dayId, unchain(day.exercises, exerciseId));
  }

  function dissolveExerciseGroup(dayId: string, label: string) {
    if (enVuelo.current) return;
    const day = days.find(d => d.id === dayId);
    if (!day) return;
    persistGroups(dayId, dissolveGroup(day.exercises, label));
  }

  async function openAssign() {
    const { data } = await supabase
      .from('users').select('id, name').eq('role', 'client').eq('coach_id', user!.id).order('name');
    setClients(data ?? []);
    setSelectedClients(new Set());
    setShowAssignModal(true);
  }

  function toggleClient(id: string) {
    setSelectedClients(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function assign() {
    if (selectedClients.size === 0) return;
    setAssigning(true);
    const { data, error } = await supabase.functions.invoke('assign-template', {
      body: { templateId, targetClientIds: Array.from(selectedClients) },
    });
    setAssigning(false);
    if (error || data?.error) {
      showAlert('Error', data?.error ?? error?.message ?? 'No se pudo asignar el programa.');
      return;
    }
    setShowAssignModal(false);
    showAlert('Asignado ✓', `El programa quedó copiado a ${selectedClients.size} cliente${selectedClients.size === 1 ? '' : 's'}. Cada copia es independiente.`);
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
        <TouchableOpacity style={styles.assignBtn} onPress={openAssign}>
          <Ionicons name="people-outline" size={13} color={colors.background} />
          <Text style={styles.assignBtnText}>ASIGNAR</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.nameBlock}>
        <TextInput
          style={styles.nameInput}
          value={name}
          onChangeText={setName}
          onBlur={saveName}
          placeholder="Nombre del programa"
          placeholderTextColor={colors.textMuted}
        />
        <View style={styles.durationRow}>
          <Text style={styles.durationLabel}>DURACIÓN</Text>
          <TextInput
            style={styles.durationInput}
            value={durationWeeks}
            onChangeText={setDurationWeeks}
            onBlur={saveDuration}
            placeholder="∞"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
          />
          <Text style={styles.durationHint}>
            {durationWeeks.trim() ? 'semanas' : 'semanas (vacío = indefinido, se repite siempre)'}
          </Text>
        </View>
        <TouchableOpacity style={styles.addDayBtn} onPress={openNewDay}>
          <Text style={styles.addDayBtnText}>+ DÍA</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {days.length === 0 && (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>SIN DÍAS AÚN</Text>
            <Text style={styles.emptyText}>Toca "+ DÍA" para crear el primer día del split.</Text>
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
            <Text style={styles.inputLabel}>DÍA DE LA SEMANA (sugerido)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekDayPicker}>
              {['—', ...WEEK_DAYS].map((d, i) => {
                // WEEK_DAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'] (índice = week_day real)
                const value = i === 0 ? null : i - 1;
                const active = newDayWeekDay === value;
                return (
                  <TouchableOpacity
                    key={d + i}
                    style={[styles.weekDayOption, active && styles.weekDayOptionActive]}
                    onPress={() => setNewDayWeekDay(value)}
                  >
                    <Text style={[styles.weekDayOptionText, active && styles.weekDayOptionTextActive]}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
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
            <Text style={styles.modalTitle}>{editingEx ? 'EDITAR EJERCICIO' : 'NUEVO EJERCICIO'}</Text>

            <Text style={styles.inputLabel}>EJERCICIO</Text>
            {editingEx ? (
              <View style={styles.lockedName}>
                <Text style={styles.lockedNameText} numberOfLines={1}>{exName}</Text>
                <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
              </View>
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
                {exLibrary.library_id && (
                  <View style={styles.pickedRow}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                    <Text style={styles.pickedText}>De la biblioteca{exLibrary.name_en ? ` · ${exLibrary.name_en}` : ''}</Text>
                  </View>
                )}
              </>
            )}

            <Text style={styles.inputLabel}>GRUPO MUSCULAR</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.repsPicker}>
              {MUSCLE_GROUPS.map(g => (
                <TouchableOpacity key={g} style={[styles.repsOption, exMuscle === g && styles.repsOptionActive]} onPress={() => setExMuscle(exMuscle === g ? '' : g)}>
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
                <TouchableOpacity key={u} style={[styles.unitOption, exUnit === u && styles.unitOptionActive]} onPress={() => setExUnit(u)}>
                  <Text style={[styles.unitOptionText, exUnit === u && styles.unitOptionTextActive]}>{u.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>PESO DE REFERENCIA (opcional)</Text>
            <TextInput style={styles.input} value={exRefWeight} onChangeText={setExRefWeight} placeholder={`ej: 20 ${exUnit}`} placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />

            <Text style={styles.inputLabel}>TEMPO (opcional, ej: 3-0-1)</Text>
            <TextInput style={styles.input} value={exTempo} onChangeText={setExTempo} placeholder="excéntrica-pausa-concéntrica" placeholderTextColor={colors.textMuted} autoCapitalize="none" />

            <Text style={styles.inputLabel}>DESCANSO ENTRE SERIES (opcional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.repsPicker}>
              {REST_OPTIONS.map(s => (
                <TouchableOpacity key={s} style={[styles.repsOption, exRest === s && styles.repsOptionActive]} onPress={() => setExRest(exRest === s ? null : s)}>
                  <Text style={[styles.repsOptionText, exRest === s && styles.repsOptionTextActive]}>
                    {s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>RIR OBJETIVO (opcional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.repsPicker}>
              {RIR_OPTIONS.map(r => (
                <TouchableOpacity key={r} style={[styles.repsOption, exTargetRir === r && styles.repsOptionActive]} onPress={() => setExTargetRir(exTargetRir === r ? '' : r)}>
                  <Text style={[styles.repsOptionText, exTargetRir === r && styles.repsOptionTextActive]}>RIR {r}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>INSTRUCCIONES / NOTAS (opcional)</Text>
            <TextInput style={[styles.input, styles.inputMultiline]} value={exNotes} onChangeText={setExNotes} placeholder="ej: Baja controlado 3 segundos, codos a 45°..." placeholderTextColor={colors.textMuted} multiline numberOfLines={3} />

            <Text style={styles.inputLabel}>NÚMERO DE SERIES</Text>
            <View style={styles.unitPicker}>
              {['1', '2', '3', '4', '5'].map(n => (
                <TouchableOpacity key={n} style={[styles.unitOption, exSeries === n && styles.unitOptionActive]} onPress={() => setExSeries(n)}>
                  <Text style={[styles.unitOptionText, exSeries === n && styles.unitOptionTextActive]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowExModal(false)}>
                <Text style={styles.cancelBtnText}>CANCELAR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={saveExercise} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.background} size="small" /> : <Text style={styles.confirmBtnText}>GUARDAR</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal: asignar a clientes */}
      <Modal visible={showAssignModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>ASIGNAR PROGRAMA</Text>
            <Text style={styles.assignHint}>
              Se copia tal cual a cada cliente elegido — el programa sigue existiendo para volver a usarlo después.
            </Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {clients.length === 0 && <Text style={styles.emptyText}>Todavía no tienes clientes.</Text>}
              {clients.map(c => {
                const checked = selectedClients.has(c.id);
                return (
                  <TouchableOpacity key={c.id} style={styles.clientRow} onPress={() => toggleClient(c.id)}>
                    <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={20} color={checked ? colors.accent : colors.textMuted} />
                    <Text style={styles.clientRowText}>{c.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAssignModal(false)}>
                <Text style={styles.cancelBtnText}>CANCELAR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={assign} disabled={assigning || selectedClients.size === 0}>
                {assigning ? <ActivityIndicator color={colors.background} size="small" />
                  : <Text style={styles.confirmBtnText}>ASIGNAR ({selectedClients.size})</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  backText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
  assignBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  assignBtnText: { color: colors.background, fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  nameBlock: { paddingHorizontal: spacing.xl, gap: spacing.sm, marginBottom: spacing.lg },
  nameInput: { ...typography.displaySm, borderBottomWidth: 2, borderBottomColor: colors.border, paddingBottom: 4 },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  durationLabel: { ...typography.label, fontSize: 10, letterSpacing: 1, color: colors.textMuted },
  durationInput: {
    width: 60, textAlign: 'center', backgroundColor: colors.surface, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border, paddingVertical: 4, color: colors.textPrimary,
  },
  durationHint: { ...typography.caption, fontSize: 10, flex: 1 },
  addDayBtn: { alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginTop: spacing.xs },
  addDayBtnText: { color: colors.background, fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.lg },
  emptyCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyTitle: { ...typography.h3, color: colors.textMuted },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },

  dayBlock: { gap: spacing.sm },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  dayHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  weekDayBadge: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  weekDayText: { color: colors.background, fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  dayName: { ...typography.h3 },
  dayHeaderActions: { flexDirection: 'row', gap: spacing.sm },
  iconBtn: { backgroundColor: colors.surface, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: colors.border },
  iconBtnText: { ...typography.caption, color: colors.accent, letterSpacing: 1 },
  iconBtnDanger: { backgroundColor: colors.surface, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: colors.danger },
  iconBtnDangerText: { ...typography.caption, color: colors.danger },

  exCard: {},
  exRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
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
  exMeta: { ...typography.caption, marginTop: 2 },
  exActions: { flexDirection: 'row', gap: spacing.sm },
  editBtn: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  addFirstEx: { paddingVertical: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: radius.md },
  addFirstExText: { ...typography.caption, color: colors.accent, letterSpacing: 1 },

  lockedName: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  lockedNameText: { ...typography.h3, fontSize: 15, flex: 1 },
  suggestBox: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.accent + '44', marginTop: -spacing.sm },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.border },
  suggestInfo: { flex: 1 },
  suggestName: { ...typography.body, fontSize: 14, fontWeight: '600' },
  suggestMeta: { ...typography.caption, fontSize: 10, marginTop: 1 },
  pickedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  pickedText: { ...typography.caption, fontSize: 11, color: colors.success },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalScroll: { maxHeight: '90%', flexGrow: 0 },
  modalBox: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg * 2, borderTopRightRadius: radius.lg * 2, padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxl },
  modalTitle: { ...typography.h2, marginBottom: spacing.sm },
  inputLabel: { ...typography.label, letterSpacing: 2, marginBottom: -spacing.sm },
  input: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.md, color: colors.textPrimary, fontSize: 15 },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  weekDayPicker: { flexGrow: 0 },
  weekDayOption: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm, backgroundColor: colors.card },
  weekDayOptionActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  weekDayOptionText: { ...typography.caption, color: colors.textMuted, fontWeight: '700' },
  weekDayOptionTextActive: { color: colors.background },
  repsPicker: { flexGrow: 0 },
  repsOption: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm, backgroundColor: colors.card },
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
  unitOption: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  unitOptionActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  unitOptionText: { ...typography.label, letterSpacing: 1 },
  unitOptionTextActive: { color: colors.background },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  cancelBtn: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  cancelBtnText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
  confirmBtn: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderRadius: radius.md, backgroundColor: colors.accent },
  confirmBtnText: { color: colors.background, fontWeight: '900', fontSize: 13, letterSpacing: 2 },
  assignHint: { ...typography.caption, marginTop: -spacing.sm },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm + 2 },
  clientRowText: { ...typography.body, fontSize: 14 },
});
