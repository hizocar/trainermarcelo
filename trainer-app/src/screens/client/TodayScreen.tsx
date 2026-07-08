import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, Image,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { TrainingDay, Exercise } from '../../types';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';
import { WEEK_DAYS, getCurrentWeek, formatShortDate } from '../../lib/weeks';

export default function TodayScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [days, setDays] = useState<TrainingDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<TrainingDay | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loggedExercises, setLoggedExercises] = useState<Set<string>>(new Set());
  const [dayStatus, setDayStatus] = useState<Record<string, { total: number; done: number }>>({});
  const [loading, setLoading] = useState(true);

  const todayWeekDay = new Date().getDay(); // 0=Dom...6=Sáb
  const currentWeek = getCurrentWeek();

  // refresca al volver de WorkoutLog para actualizar los checks de completado
  useFocusEffect(useCallback(() => {
    if (user?.id && days.length === 0) fetchPlan();
    else if (selectedDay) {
      fetchExercises(selectedDay.id);
      fetchWeekStatus(days);
    }
  }, [user?.id, selectedDay?.id]));

  async function fetchPlan() {
    const { data: planData } = await supabase
      .from('workout_plans').select('*')
      .eq('client_id', user?.id).single();

    if (planData) {
      const { data: daysData } = await supabase
        .from('training_days').select('*')
        .eq('plan_id', planData.id)
        .order('week_day', { nullsFirst: false });

      const activeDays = (daysData ?? []).filter(d => !d.name.toLowerCase().includes('libre'));
      setDays(activeDays);
      fetchWeekStatus(activeDays);

      // Auto-seleccionar el día de hoy si existe, si no el primero
      const todayDay = activeDays.find(d => d.week_day === todayWeekDay);
      setSelectedDay(todayDay ?? activeDays[0] ?? null);
    }
    setLoading(false);
  }

  async function fetchExercises(dayId: string) {
    const { data } = await supabase
      .from('exercises').select('*')
      .eq('day_id', dayId).order('order_index');
    const exs = data ?? [];
    setExercises(exs);

    // marcar ejercicios ya registrados esta semana
    if (exs.length > 0) {
      const { data: series } = await supabase
        .from('exercise_series')
        .select('id, exercise_id')
        .in('exercise_id', exs.map(e => e.id));

      const seriesIds = (series ?? []).map(s => s.id);
      if (seriesIds.length > 0) {
        const { data: logs } = await supabase
          .from('workout_logs')
          .select('series_id')
          .in('series_id', seriesIds)
          .eq('week_number', currentWeek);

        const loggedSeriesIds = new Set((logs ?? []).map(l => l.series_id));
        const done = new Set(
          (series ?? []).filter(s => loggedSeriesIds.has(s.id)).map(s => s.exercise_id)
        );
        setLoggedExercises(done);
        return;
      }
    }
    setLoggedExercises(new Set());
  }

  // completado semanal de TODOS los días (para los checks de los tabs)
  async function fetchWeekStatus(dayList: TrainingDay[]) {
    if (dayList.length === 0) return;
    const { data: exs } = await supabase
      .from('exercises').select('id, day_id')
      .in('day_id', dayList.map(d => d.id));
    const { data: series } = await supabase
      .from('exercise_series').select('id, exercise_id')
      .in('exercise_id', (exs ?? []).map(e => e.id));
    const { data: logs } = await supabase
      .from('workout_logs').select('series_id')
      .in('series_id', (series ?? []).map(s => s.id))
      .eq('week_number', currentWeek);

    const loggedSeries = new Set((logs ?? []).map(l => l.series_id));
    const doneEx = new Set((series ?? []).filter(s => loggedSeries.has(s.id)).map(s => s.exercise_id));
    const status: Record<string, { total: number; done: number }> = {};
    dayList.forEach(d => { status[d.id] = { total: 0, done: 0 }; });
    (exs ?? []).forEach(e => {
      const st = status[e.day_id];
      if (!st) return;
      st.total++;
      if (doneEx.has(e.id)) st.done++;
    });
    setDayStatus(status);
  }

  const isToday = (day: TrainingDay) => day.week_day === todayWeekDay;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            {formatShortDate(new Date().toISOString()).toUpperCase()}
          </Text>
          <Text style={styles.userName}>{user?.name?.split(' ')[0].toUpperCase()}</Text>
        </View>
        {selectedDay && (
          <View style={[styles.weekBadge, isToday(selectedDay) && styles.weekBadgeToday]}>
            <Text style={[styles.weekBadgeText, !isToday(selectedDay) && styles.weekBadgeTextIdle]}>
              D{selectedDay.day_number}
            </Text>
          </View>
        )}
      </View>

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
                  onPress={() => setSelectedDay(day)}
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

          {/* Indicador de si es el día de hoy + progreso del día */}
          {selectedDay && (
            <View style={styles.dayIndicator}>
              <View style={[styles.dayIndicatorDot, isToday(selectedDay) && styles.dayIndicatorDotActive]} />
              <Text style={styles.dayIndicatorText}>
                {isToday(selectedDay)
                  ? 'SUGERIDO PARA HOY'
                  : selectedDay.week_day != null
                    ? `SUGERIDO PARA EL ${WEEK_DAYS[selectedDay.week_day].toUpperCase()} · ENTRENA CUANDO PUEDAS`
                    : 'ENTRENA CUANDO PUEDAS'}
              </Text>
              {exercises.length > 0 && (
                <Text style={styles.dayProgress}>
                  {loggedExercises.size}/{exercises.length}
                </Text>
              )}
            </View>
          )}

          {/* barra de progreso del día */}
          {exercises.length > 0 && (
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round((loggedExercises.size / exercises.length) * 100)}%` },
                ]}
              />
            </View>
          )}

          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {exercises.map(ex => {
              const done = loggedExercises.has(ex.id);
              return (
                <TouchableOpacity
                  key={ex.id}
                  onPress={() => navigation.navigate('WorkoutLog', { exercise: ex, week: currentWeek })}
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
                        {ex.superseries_group && (
                          <Text style={styles.superTag}>⛓ {ex.superseries_group}</Text>
                        )}
                        <Text style={styles.exerciseName}>{ex.name}</Text>
                        <Text style={styles.exerciseMeta}>
                          {ex.muscle_group ? `${ex.muscle_group} · ` : ''}{ex.reps_objective} reps · {ex.unit}
                          {ex.ref_weight ? ` · ref ${ex.ref_weight}${ex.unit}` : ''}
                        </Text>
                      </View>
                      <View style={[styles.logBtn, done && styles.logBtnDone]}>
                        <Ionicons
                          name={done ? 'checkmark' : 'add'}
                          size={22}
                          color={done ? colors.background : colors.background}
                        />
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })}

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

  dayTabsScroll: { flexGrow: 0, height: 68, marginBottom: spacing.xs },
  dayTabs: { paddingHorizontal: spacing.xl, gap: spacing.sm, alignItems: 'center' },
  dayTab: {
    paddingHorizontal: spacing.md,
    height: 56, justifyContent: 'center',
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: 'center', minWidth: 76, maxWidth: 130, position: 'relative',
  },
  dayTabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayTabDone: { borderColor: colors.success + '88' },
  tabBadge: { position: 'absolute', top: 3, right: 4 },
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
  dayIndicatorDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted },
  dayIndicatorDotActive: { backgroundColor: colors.accent },
  dayIndicatorText: { ...typography.caption, letterSpacing: 1.5, color: colors.textMuted, flex: 1 },
  dayProgress: { ...typography.caption, color: colors.accent, fontWeight: '900', letterSpacing: 1 },
  progressTrack: {
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },

  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.sm },
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
