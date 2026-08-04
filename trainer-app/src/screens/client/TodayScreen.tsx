import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, Image, TextInput,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { TrainingDay, Exercise } from '../../types';
import { fetchFullPlan, fetchLogs, activeDays, PlanDay, PlanExercise } from '../../lib/plan';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';
import SyncBanner from '../../components/common/SyncBanner';
import { WEEK_DAYS, getCurrentWeek, formatShortDate, weekStartLabel, daysUntilWeek, dateForWeekDay } from '../../lib/weeks';
import { showAlert } from '../../lib/alert';
import { refreshReminders } from '../../lib/notifications';

const PHASE_INFO: Record<string, { label: string; color: string }> = {
  acumulacion: { label: 'ACUMULACIÓN', color: colors.accent },
  intensificacion: { label: 'INTENSIFICACIÓN', color: colors.textSecondary },
  descarga: { label: 'DESCARGA', color: colors.textMuted },
};

export default function TodayScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [days, setDays] = useState<PlanDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<PlanDay | null>(null);
  const selectedIdRef = React.useRef<string | null>(null);
  const [exercises, setExercises] = useState<PlanExercise[]>([]);
  const [loggedExercises, setLoggedExercises] = useState<Set<string>>(new Set());
  const [dayStatus, setDayStatus] = useState<Record<string, { total: number; done: number }>>({});
  const [phase, setPhase] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [noteDirty, setNoteDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allLogs, setAllLogs] = useState<{ series_id: string; week_number: number }[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeek());
  const seriesToExerciseRef = React.useRef<Record<string, string> | undefined>(undefined);

  const todayWeekDay = new Date().getDay(); // 0=Dom...6=Sáb
  const currentWeek = getCurrentWeek();
  const viewingPastWeek = selectedWeek !== currentWeek;

  // refresca al volver de WorkoutLog para actualizar los checks de completado
  useFocusEffect(useCallback(() => { if (user?.id) fetchPlan(); }, [user?.id]));
  // al cambiar de semana recalculamos sin volver a pedir el plan completo
  React.useEffect(() => { if (user?.id && days.length > 0) applyWeek(days, allLogs); }, [selectedWeek]);

  async function fetchPlan() {
    if (!user?.id) return;
    const plan = await fetchFullPlan(user.id);
    if (!plan) { setLoading(false); return; }

    const { data: ph } = await supabase
      .from('week_phases').select('phase')
      .eq('plan_id', plan.id).eq('week_number', selectedWeek).maybeSingle();
    setPhase(ph?.phase ?? null);

    const list = activeDays(plan.days);
    setDays(list);

    // todos los logs del plan en una consulta: navegar entre semanas no vuelve a pedir nada
    const logs = await fetchLogs(plan.seriesIds);
    setAllLogs(logs);
    applyWeek(list, logs, plan.seriesToExercise);

    setLoading(false);
  }

  // recalcula estado (ejercicios hechos, progreso, recordatorios) para la semana elegida
  function applyWeek(
    list: PlanDay[],
    logs: { series_id: string; week_number: number }[],
    seriesToExercise?: Record<string, string>,
  ) {
    const map = seriesToExercise ?? seriesToExerciseRef.current;
    if (!map) return;
    seriesToExerciseRef.current = map;

    const loggedSeries = new Set(logs.filter(l => l.week_number === selectedWeek).map(l => l.series_id));
    const doneEx = new Set(
      Object.entries(map).filter(([sid]) => loggedSeries.has(sid)).map(([, exId]) => exId),
    );
    setLoggedExercises(doneEx);

    const status: Record<string, { total: number; done: number }> = {};
    list.forEach(d => {
      status[d.id] = {
        total: d.exercises.length,
        done: d.exercises.filter(e => doneEx.has(e.id)).length,
      };
    });
    setDayStatus(status);

    // los recordatorios siempre miran la semana REAL de hoy, no la que se está navegando
    const currentLoggedSeries = new Set(logs.filter(l => l.week_number === currentWeek).map(l => l.series_id));
    const currentDoneEx = new Set(
      Object.entries(map).filter(([sid]) => currentLoggedSeries.has(sid)).map(([, exId]) => exId),
    );
    refreshReminders(list.map(d => {
      const total = d.exercises.length;
      const done = d.exercises.filter(e => currentDoneEx.has(e.id)).length;
      return { id: d.id, day_number: d.day_number, name: d.name, week_day: d.week_day, done: total > 0 && done >= total };
    }));

    // selección: conservar la elección manual; si no hay, el primer día incompleto
    const isDayComplete = (d: PlanDay) =>
      (status[d.id]?.total ?? 0) > 0 && status[d.id].done >= status[d.id].total;

    const prevId = selectedIdRef.current;
    const kept = prevId ? list.find(d => d.id === prevId) : undefined;
    const firstIncomplete = list.find(d => !isDayComplete(d));
    const selected = kept ?? firstIncomplete ?? list.find(d => d.week_day === todayWeekDay) ?? list[0] ?? null;
    selectedIdRef.current = selected?.id ?? null;
    setSelectedDay(selected);
    setExercises(selected?.exercises ?? []);
    if (selected) loadNote(selected.id);
  }

  async function loadNote(dayId: string) {
    const { data } = await supabase
      .from('session_notes').select('note')
      .eq('user_id', user!.id).eq('day_id', dayId).eq('week_number', selectedWeek)
      .maybeSingle();
    setNote(data?.note ?? '');
    setNoteDirty(false);
  }

  function selectDay(day: PlanDay) {
    selectedIdRef.current = day.id;
    setSelectedDay(day);
    setExercises(day.exercises);
    loadNote(day.id);
  }

  async function saveNote() {
    if (!selectedDay || !note.trim()) return;
    const { error } = await supabase.from('session_notes').upsert(
      { user_id: user!.id, day_id: selectedDay.id, week_number: selectedWeek, note: note.trim() },
      { onConflict: 'user_id,day_id,week_number' },
    );
    if (error) showAlert('No se pudo guardar', error.message);
    else setNoteDirty(false);
  }

  const isToday = (day: TrainingDay) => !viewingPastWeek && day.week_day === todayWeekDay;

  // ¿todos los días del plan completados en la semana que se está viendo?
  const weekComplete = days.length > 0 && days.every(d => {
    const st = dayStatus[d.id];
    return st && st.total > 0 && st.done >= st.total;
  });
  const nextWeek = currentWeek + 1;
  const daysToNext = daysUntilWeek(nextWeek);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            {formatShortDate(new Date().toISOString()).toUpperCase()}
          </Text>
          <Text style={styles.userName}>{user?.name?.split(' ')[0].toUpperCase()}</Text>
          {phase && PHASE_INFO[phase] && (
            <View style={[styles.phaseBadge, { borderColor: PHASE_INFO[phase].color }]}>
              <Text style={[styles.phaseText, { color: PHASE_INFO[phase].color }]}>
                FASE · {PHASE_INFO[phase].label}
              </Text>
            </View>
          )}
        </View>
        {selectedDay && (
          <View style={[styles.weekBadge, isToday(selectedDay) && styles.weekBadgeToday]}>
            <Text style={[styles.weekBadgeText, !isToday(selectedDay) && styles.weekBadgeTextIdle]}>
              D{selectedDay.day_number}
            </Text>
          </View>
        )}
      </View>

      {!loading && days.length > 0 && (
        <View style={styles.weekNav}>
          <TouchableOpacity
            style={styles.weekNavBtn}
            onPress={() => setSelectedWeek(w => Math.max(1, w - 1))}
            disabled={selectedWeek <= 1}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={16} color={selectedWeek <= 1 ? colors.textMuted : colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.weekNavLabel}>
            SEMANA {selectedWeek}{viewingPastWeek ? ' · PASADA' : ''}
          </Text>
          <TouchableOpacity
            style={styles.weekNavBtn}
            onPress={() => setSelectedWeek(w => Math.min(currentWeek, w + 1))}
            disabled={selectedWeek >= currentWeek}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-forward" size={16} color={selectedWeek >= currentWeek ? colors.textMuted : colors.textPrimary} />
          </TouchableOpacity>
          {viewingPastWeek && (
            <TouchableOpacity style={styles.weekNavToday} onPress={() => setSelectedWeek(currentWeek)}>
              <Text style={styles.weekNavTodayText}>VOLVER A HOY</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {viewingPastWeek && (
        <View style={styles.pastBanner}>
          <Ionicons name="time-outline" size={14} color={colors.accent} />
          <Text style={styles.pastBannerText}>
            ¿Se te quedó pendiente un día? Regístralo acá — quedará guardado en la fecha que indiques.
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : days.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>SIN PLAN</Text>
          <Text style={styles.emptyText}>Tu coach aún no ha configurado tu plan de entrenamiento.</Text>
        </View>
      ) : (
        <>
          {/* Selector de días */}
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            style={styles.dayTabsScroll}
            contentContainerStyle={styles.dayTabs}
          >
            {days.map(day => {
              const active = selectedDay?.id === day.id;
              const isCurrentDay = isToday(day);
              const st = dayStatus[day.id];
              const complete = !!st && st.total > 0 && st.done >= st.total;
              return (
                <TouchableOpacity
                  key={day.id}
                  style={[styles.dayTab, active && styles.dayTabActive, complete && !active && styles.dayTabDone]}
                  onPress={() => selectDay(day)}
                  activeOpacity={0.7}
                >
                  {complete ? (
                    <View style={styles.tabBadge}>
                      <Ionicons name="checkmark-circle" size={15} color={active ? colors.background : colors.success} />
                    </View>
                  ) : isCurrentDay ? (
                    <View style={styles.todayDot} />
                  ) : null}
                  <Text style={[styles.dayTabNum, active && styles.dayTabNumActive]}>
                    DÍA {day.day_number}
                  </Text>
                  <Text style={[styles.dayTabName, active && styles.dayTabNameActive]} numberOfLines={1}>
                    {day.name.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* barra de progreso del día */}
          {exercises.length > 0 && selectedDay && (
            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.round(((dayStatus[selectedDay.id]?.done ?? 0) / exercises.length) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressCount}>
                {dayStatus[selectedDay.id]?.done ?? 0}/{exercises.length}
              </Text>
            </View>
          )}

          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            <SyncBanner />

            {weekComplete && !viewingPastWeek && (
              <Card highlight style={styles.doneCard}>
                <View style={styles.doneHeader}>
                  <Ionicons name="trophy" size={22} color={colors.accent} />
                  <View style={styles.doneInfo}>
                    <Text style={styles.doneTitle}>¡SEMANA {currentWeek} COMPLETA!</Text>
                    <Text style={styles.doneSub}>
                      Terminaste los {days.length} días de entrenamiento 💪
                    </Text>
                  </View>
                </View>

                <View style={styles.doneDivider} />

                <Text style={styles.nextLabel}>LO QUE VIENE</Text>
                <Text style={styles.nextText}>
                  {daysToNext === 0
                    ? `La semana ${nextWeek} ya empezó — registra tu Día 1 cuando entrenes.`
                    : daysToNext === 1
                      ? `La semana ${nextWeek} empieza mañana (${weekStartLabel(nextWeek)}).`
                      : `La semana ${nextWeek} empieza el ${weekStartLabel(nextWeek)} (en ${daysToNext} días).`}
                </Text>
                <Text style={styles.nextHint}>
                  Mientras tanto puedes revisar o corregir lo que registraste tocando cualquier ejercicio.
                </Text>
              </Card>
            )}
            {exercises.map(ex => {
              const done = loggedExercises.has(ex.id);
              return (
                <TouchableOpacity
                  key={ex.id}
                  onPress={() => navigation.navigate('WorkoutLog', {
                    exercise: ex,
                    week: selectedWeek,
                    date: selectedDay?.week_day != null
                      ? dateForWeekDay(selectedWeek, selectedDay.week_day).toISOString()
                      : undefined,
                  })}
                  activeOpacity={0.7}
                >
                  <Card style={done ? { ...styles.exerciseCard, ...styles.exerciseCardDone } : styles.exerciseCard}>
                    <View style={styles.exerciseRow}>
                      {ex.image_url ? (
                        <Image source={{ uri: ex.image_url }} style={styles.thumb} />
                      ) : (
                        <View style={[styles.thumb, styles.thumbPlaceholder]}>
                          <Ionicons name="barbell-outline" size={22} color={colors.textMuted} />
                        </View>
                      )}
                      <View style={styles.exerciseInfo}>
                        <Text style={styles.exerciseName}>{ex.name}</Text>
                        <Text style={styles.exerciseMeta}>
                          {ex.muscle_group ? `${ex.muscle_group} · ` : ''}
                          {ex.exercise_series.length} series · {ex.reps_objective} reps
                          {ex.ref_weight ? ` · ref ${ex.ref_weight}${ex.unit}` : ''}
                        </Text>
                      </View>
                      <View style={[styles.logBtn, done && styles.logBtnDone]}>
                        <Ionicons name={done ? 'checkmark' : 'add'} size={22} color={colors.background} />
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })}

            {exercises.length > 0 && selectedDay && (
              <Card style={styles.noteCard}>
                <Text style={styles.noteTitle}>NOTA PARA TU COACH</Text>
                <TextInput
                  style={styles.noteInput}
                  value={note}
                  onChangeText={v => { setNote(v); setNoteDirty(true); }}
                  placeholder="ej: sentí molestia en el hombro en la S3..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
                {noteDirty && note.trim().length > 0 && (
                  <TouchableOpacity style={styles.noteSave} onPress={saveNote}>
                    <Text style={styles.noteSaveText}>GUARDAR NOTA</Text>
                  </TouchableOpacity>
                )}
                {!noteDirty && note.trim().length > 0 && (
                  <Text style={styles.noteSaved}>✓ Guardada — tu coach la verá</Text>
                )}
              </Card>
            )}

            {exercises.length === 0 && selectedDay && (
              <Card style={styles.noExCard}>
                <Text style={styles.noExTitle}>SIN EJERCICIOS</Text>
                <Text style={styles.noExText}>
                  Tu coach aún no ha agregado ejercicios para el {selectedDay.week_day != null ? WEEK_DAYS[selectedDay.week_day] : `Día ${selectedDay.day_number}`}.
                </Text>
              </Card>
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: spacing.xl, marginBottom: spacing.lg,
  },
  greeting: { ...typography.label, letterSpacing: 2, color: colors.accent },
  userName: { ...typography.display, fontSize: 34, marginTop: 2 },
  weekBadge: {
    width: 52, height: 52, borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  weekBadgeToday: { backgroundColor: colors.accent, borderColor: colors.accent },
  weekBadgeText: { color: colors.background, fontWeight: '900', fontSize: 16 },
  weekBadgeTextIdle: { color: colors.accent },
  weekNav: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.xl, marginBottom: spacing.sm,
  },
  weekNavBtn: {
    width: 30, height: 30, borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  weekNavLabel: { ...typography.label, letterSpacing: 1.5, fontSize: 11 },
  weekNavToday: {
    marginLeft: 'auto',
    borderWidth: 1, borderColor: colors.accent, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  weekNavTodayText: { fontSize: 9, fontWeight: '900', letterSpacing: 1, color: colors.accent },
  pastBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    marginHorizontal: spacing.xl, marginBottom: spacing.sm,
    backgroundColor: colors.accentSoft, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.accent + '33',
    paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs + 2,
  },
  pastBannerText: { ...typography.caption, fontSize: 11, flex: 1, color: colors.textSecondary },
  phaseBadge: {
    alignSelf: 'flex-start', marginTop: spacing.xs,
    borderWidth: 1, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  phaseText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  noteCard: { gap: spacing.sm, marginTop: spacing.sm },
  noteTitle: { ...typography.label, letterSpacing: 2 },
  noteInput: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    color: colors.textPrimary, fontSize: 14, minHeight: 60, textAlignVertical: 'top',
  },
  noteSave: { alignSelf: 'flex-end' },
  noteSaveText: { ...typography.label, color: colors.accent, letterSpacing: 1.5 },
  noteSaved: { ...typography.caption, fontSize: 10, color: colors.success, textAlign: 'right' },

  dayTabsScroll: { flexGrow: 0, marginBottom: spacing.xs },
  dayTabs: { paddingHorizontal: spacing.xl, gap: spacing.sm, alignItems: 'center', paddingVertical: spacing.xs },
  dayTab: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md, paddingBottom: spacing.sm,
    justifyContent: 'center',
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: 'center', minWidth: 82, maxWidth: 140, position: 'relative',
  },
  dayTabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayTabDone: { borderColor: colors.success + '88' },
  tabBadge: { position: 'absolute', top: 5, right: 6 },
  todayDot: {
    position: 'absolute', top: 4, right: 6,
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: colors.accent,
  },
  dayTabNum: { fontSize: 12, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.5 },
  dayTabNumActive: { color: colors.background },
  dayTabName: { fontSize: 9, fontWeight: '700', color: colors.textMuted, marginTop: 2 },
  dayTabNameActive: { color: colors.background },

  dayIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.sm,
  },
  progressRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.xl, marginBottom: spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  progressCount: { fontSize: 11, fontWeight: '900', color: colors.accent, letterSpacing: 0.5 },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },

  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.sm },
  doneCard: { gap: spacing.sm, marginBottom: spacing.sm },
  doneHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  doneInfo: { flex: 1 },
  doneTitle: { ...typography.displaySm, fontSize: 18, color: colors.accent },
  doneSub: { ...typography.caption, marginTop: 1 },
  doneDivider: { height: 1, backgroundColor: colors.border },
  nextLabel: { ...typography.label, letterSpacing: 2, fontSize: 9 },
  nextText: { ...typography.body, fontSize: 14 },
  nextHint: { ...typography.caption, fontSize: 10, fontStyle: 'italic' },
  exerciseCard: { },
  exerciseCardDone: { borderColor: colors.accent + '66' },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  thumb: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surface },
  thumbPlaceholder: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  exerciseInfo: { flex: 1 },
  superTag: { ...typography.caption, color: colors.accent, marginBottom: 2 },
  exerciseName: { ...typography.h3 },
  exerciseMeta: { ...typography.caption, marginTop: 2 },
  logBtn: {
    width: 40, height: 40, borderRadius: radius.full,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  logBtnDone: { backgroundColor: colors.success },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  emptyTitle: { ...typography.h2, color: colors.textMuted, marginBottom: spacing.sm },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  noExCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  noExTitle: { ...typography.h3, color: colors.textMuted },
  noExText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
