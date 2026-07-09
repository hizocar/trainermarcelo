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

const REPS_OPTIONS = ['4-6', '6-8', '8-10', '8-12', '10-12', '12-15', '10-15'];
const MUSCLE_GROUPS = [
  'Pecho', 'Espalda alta', 'Espalda baja',
  'Hombro anterior', 'Hombro medial', 'Hombro posterior',
  'Bíceps', 'Tríceps', 'Antebrazos',
  'Cuádriceps', 'Isquiotibiales', 'Aductor',
  'Glúteo mayor', 'Glúteo medio', 'Glúteo menor',
  'Gastrocnemios', 'Core',
];

type RouteParams = { client: User };

interface DayWithExercises extends TrainingDay {
  exercises: Exercise[];
}

export default function PlanEditorScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { client } = route.params as RouteParams;
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
  const [exReps, setExReps] = useState('8-12');
  const [exUnit, setExUnit] = useState<'kg' | 'lb'>('kg');
  const [exRefWeight, setExRefWeight] = useState('');
  const [exSuperseries, setExSuperseries] = useState('');
  const [exSeries, setExSeries] = useState('3');
  const [exNotes, setExNotes] = useState('');
  const [exMuscle, setExMuscle] = useState('');
  const [exVideoUrl, setExVideoUrl] = useState('');
  const [exImageUrl, setExImageUrl] = useState<string | null>(null);
  const [exNewImage, setExNewImage] = useState<ImagePickerAsset | null>(null);
  const [exNewVideo, setExNewVideo] = useState<ImagePickerAsset | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [editingEx, setEditingEx] = useState<Exercise | null>(null);
  const [suggestions, setSuggestions] = useState<{ id: string; name: string; name_en: string | null; muscle_group: string; equipment: string | null }[]>([]);
  const [exLibrary, setExLibrary] = useState<{ name_en: string | null; library_id: string | null }>({ name_en: null, library_id: null });
  const searchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { fetchPlan(); }, []);

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
      .eq('plan_id', currentPlan.id).order('week_day');

    const daysWithEx: DayWithExercises[] = [];
    for (const d of (daysData ?? [])) {
      const { data: exData } = await supabase
        .from('exercises').select('*')
        .eq('day_id', d.id).order('order_index');
      daysWithEx.push({ ...d, exercises: exData ?? [] });
    }
    setDays(daysWithEx);
    setLoading(false);
  }

  async function addDay() {
    if (!newDayName.trim() || !plan) return;
    setSaving(true);
    const dayNumber = days.length + 1;
    const { data, error } = await supabase
      .from('training_days')
      .insert({ plan_id: plan.id, day_number: dayNumber, name: newDayName.trim(), week_day: newDayWeekDay })
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
    showConfirm('Eliminar día', '¿Seguro? Se eliminarán todos los ejercicios.', async () => {
      await supabase.from('training_days').delete().eq('id', dayId);
      setDays(prev => prev.filter(d => d.id !== dayId));
    }, 'Eliminar');
  }

  function openAddExercise(dayId: string) {
    setTargetDayId(dayId);
    setExName(''); setExReps('8-12'); setExUnit('kg');
    setExRefWeight(''); setExSuperseries(''); setExSeries('3');
    setExNotes(''); setExVideoUrl(''); setExImageUrl(null); setExNewImage(null);
    setExMuscle('');
    setExLibrary({ name_en: null, library_id: null });
    setExNewVideo(null);
    setEditingEx(null);
    setShowExModal(true);
  }

  function openEditExercise(ex: Exercise) {
    setTargetDayId(ex.day_id);
    setExName(ex.name);
    setExReps(ex.reps_objective);
    setExUnit(ex.unit);
    setExRefWeight(ex.ref_weight?.toString() ?? '');
    setExSuperseries(ex.superseries_group ?? '');
    setExSeries('3');
    setExNotes(ex.notes ?? '');
    setExMuscle(ex.muscle_group ?? '');
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
    setSaving(true);
    const seriesCount = parseInt(exSeries) || 3;

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
    };

    if (editingEx) {
      const { data, error } = await supabase.from('exercises').update({
        name: exName.trim(),
        reps_objective: exReps,
        unit: exUnit,
        ref_weight: exRefWeight ? parseFloat(exRefWeight) : null,
        superseries_group: exSuperseries.trim() || null,
        ...mediaFields,
      }).eq('id', editingEx.id).select().single();

      if (error) {
        setSaving(false);
        showAlert('Error al guardar', error.message);
        return;
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
        reps_objective: exReps,
        unit: exUnit,
        ref_weight: exRefWeight ? parseFloat(exRefWeight) : null,
        superseries_group: exSuperseries.trim() || null,
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
    // persistir usando las posiciones del array como orden canónico
    await supabase.from('exercises').update({ order_index: index }).eq('id', b.id);
    await supabase.from('exercises').update({ order_index: j }).eq('id', a.id);
  }

  function deleteExercise(ex: Exercise) {
    showConfirm('Eliminar ejercicio', `¿Eliminar "${ex.name}"?`, async () => {
      await supabase.from('exercises').delete().eq('id', ex.id);
      setDays(prev => prev.map(d => ({
        ...d,
        exercises: d.exercises.filter(e => e.id !== ex.id)
      })));
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
          <Text style={styles.headerLabel}>PLAN DE</Text>
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
                <TouchableOpacity onPress={() => openAddExercise(day.id)} style={styles.iconBtn}>
                  <Text style={styles.iconBtnText}>+ EJ.</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteDay(day.id)} style={styles.iconBtnDanger}>
                  <Text style={styles.iconBtnDangerText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {day.exercises.map((ex, idx) => (
              <Card key={ex.id} style={styles.exCard}>
                <View style={styles.exRow}>
                  <View style={styles.reorderCol}>
                    <TouchableOpacity
                      onPress={() => moveExercise(day.id, idx, -1)}
                      disabled={idx === 0}
                      style={styles.reorderBtn}
                      hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
                    >
                      <Ionicons name="chevron-up" size={15} color={idx === 0 ? colors.border : colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => moveExercise(day.id, idx, 1)}
                      disabled={idx === day.exercises.length - 1}
                      style={styles.reorderBtn}
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
                      <Text style={styles.superTag}>⛓ {ex.superseries_group}</Text>
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

            <Text style={styles.inputLabel}>NOMBRE</Text>
            <TextInput
              style={styles.input}
              value={exName}
              onChangeText={onExNameChange}
              placeholder="ej: Press banca, Sentadilla"
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

            <Text style={styles.inputLabel}>GRUPO / SUPERSERIE (opcional)</Text>
            <TextInput
              style={styles.input}
              value={exSuperseries}
              onChangeText={setExSuperseries}
              placeholder="ej: Superserie 1"
              placeholderTextColor={colors.textMuted}
            />

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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.repsPicker}>
              {REPS_OPTIONS.map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.repsOption, exReps === r && styles.repsOptionActive]}
                  onPress={() => setExReps(r)}
                >
                  <Text style={[styles.repsOptionText, exReps === r && styles.repsOptionTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

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

            {!editingEx && (
              <>
                <Text style={styles.inputLabel}>NÚMERO DE SERIES</Text>
                <View style={styles.unitPicker}>
                  {['2', '3', '4'].map(n => (
                    <TouchableOpacity
                      key={n}
                      style={[styles.unitOption, exSeries === n && styles.unitOptionActive]}
                      onPress={() => setExSeries(n)}
                    >
                      <Text style={[styles.unitOptionText, exSeries === n && styles.unitOptionTextActive]}>{n}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

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
  superTag: { ...typography.caption, color: colors.accent, marginBottom: 2 },
  exName: { ...typography.h3 },
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
