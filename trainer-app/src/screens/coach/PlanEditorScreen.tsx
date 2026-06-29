import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { User, WorkoutPlan, TrainingDay, Exercise } from '../../types';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';

const WEEK_DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const REPS_OPTIONS = ['4-6', '6-8', '8-10', '8-12', '10-12', '12-15', '10-15'];

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
  const [editingEx, setEditingEx] = useState<Exercise | null>(null);

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

  async function deleteDay(dayId: string) {
    Alert.alert('Eliminar día', '¿Seguro? Se eliminarán todos los ejercicios.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          await supabase.from('training_days').delete().eq('id', dayId);
          setDays(prev => prev.filter(d => d.id !== dayId));
        }
      }
    ]);
  }

  function openAddExercise(dayId: string) {
    setTargetDayId(dayId);
    setExName(''); setExReps('8-12'); setExUnit('kg');
    setExRefWeight(''); setExSuperseries(''); setExSeries('3');
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
    setEditingEx(ex);
    setShowExModal(true);
  }

  async function saveExercise() {
    if (!exName.trim()) return;
    setSaving(true);
    const seriesCount = parseInt(exSeries) || 3;

    if (editingEx) {
      const { data } = await supabase.from('exercises').update({
        name: exName.trim(),
        reps_objective: exReps,
        unit: exUnit,
        ref_weight: exRefWeight ? parseFloat(exRefWeight) : null,
        superseries_group: exSuperseries.trim() || null,
      }).eq('id', editingEx.id).select().single();

      if (data) {
        setDays(prev => prev.map(d => ({
          ...d,
          exercises: d.exercises.map(e => e.id === editingEx.id ? { ...e, ...data } : e)
        })));
      }
    } else {
      const day = days.find(d => d.id === targetDayId)!;
      const orderIndex = day.exercises.length;
      const { data: exData } = await supabase.from('exercises').insert({
        day_id: targetDayId,
        name: exName.trim(),
        reps_objective: exReps,
        unit: exUnit,
        ref_weight: exRefWeight ? parseFloat(exRefWeight) : null,
        superseries_group: exSuperseries.trim() || null,
        order_index: orderIndex,
      }).select().single();

      if (exData) {
        for (let i = 1; i <= seriesCount; i++) {
          await supabase.from('exercise_series').insert({ exercise_id: exData.id, series_number: i });
        }
        setDays(prev => prev.map(d =>
          d.id === targetDayId ? { ...d, exercises: [...d.exercises, exData] } : d
        ));
      }
    }
    setShowExModal(false);
    setSaving(false);
  }

  async function deleteExercise(ex: Exercise) {
    Alert.alert('Eliminar ejercicio', `¿Eliminar "${ex.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          await supabase.from('exercises').delete().eq('id', ex.id);
          setDays(prev => prev.map(d => ({
            ...d,
            exercises: d.exercises.filter(e => e.id !== ex.id)
          })));
        }
      }
    ]);
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

            {day.exercises.map(ex => (
              <Card key={ex.id} style={styles.exCard}>
                <View style={styles.exRow}>
                  <View style={styles.exInfo}>
                    {ex.superseries_group && (
                      <Text style={styles.superTag}>🔗 {ex.superseries_group}</Text>
                    )}
                    <Text style={styles.exName}>{ex.name}</Text>
                    <Text style={styles.exMeta}>
                      {ex.reps_objective} reps · {ex.unit}
                      {ex.ref_weight ? ` · ref ${ex.ref_weight}${ex.unit}` : ''}
                    </Text>
                  </View>
                  <View style={styles.exActions}>
                    <TouchableOpacity onPress={() => openEditExercise(ex)} style={styles.editBtn}>
                      <Text style={styles.editBtnText}>✏</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteExercise(ex)} style={styles.deleteBtn}>
                      <Text style={styles.deleteBtnText}>✕</Text>
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
          <ScrollView contentContainerStyle={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {editingEx ? 'EDITAR EJERCICIO' : 'NUEVO EJERCICIO'}
            </Text>

            <Text style={styles.inputLabel}>NOMBRE</Text>
            <TextInput
              style={styles.input}
              value={exName}
              onChangeText={setExName}
              placeholder="ej: Press banca, Sentadilla"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />

            <Text style={styles.inputLabel}>GRUPO / SUPERSERIE (opcional)</Text>
            <TextInput
              style={styles.input}
              value={exSuperseries}
              onChangeText={setExSuperseries}
              placeholder="ej: Superserie 1"
              placeholderTextColor={colors.textMuted}
            />

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
  headerName: { fontSize: 22, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.5 },
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
  exRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
