import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { TrainingDay, WorkoutPlan, Exercise } from '../../types';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';

const WEEK_DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const WEEK_DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function TodayScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [days, setDays] = useState<TrainingDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<TrainingDay | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  const todayWeekDay = new Date().getDay(); // 0=Dom...6=Sáb
  const currentWeek = getCurrentWeek();

  useEffect(() => { fetchPlan(); }, []);
  useEffect(() => { if (selectedDay) fetchExercises(selectedDay.id); }, [selectedDay]);

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
    setExercises(data ?? []);
  }

  const isToday = (day: TrainingDay) => day.week_day === todayWeekDay;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            {WEEK_DAYS[todayWeekDay].toUpperCase()} · SEMANA {currentWeek}
          </Text>
          <Text style={styles.userName}>{user?.name?.split(' ')[0].toUpperCase()}</Text>
        </View>
        <View style={[styles.weekBadge, isToday(selectedDay!) && styles.weekBadgeToday]}>
          <Text style={styles.weekBadgeText}>S{currentWeek}</Text>
        </View>
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
            contentContainerStyle={styles.dayTabs}
          >
            {days.map(day => {
              const active = selectedDay?.id === day.id;
              const isCurrentDay = isToday(day);
              return (
                <TouchableOpacity
                  key={day.id}
                  style={[styles.dayTab, active && styles.dayTabActive]}
                  onPress={() => setSelectedDay(day)}
                  activeOpacity={0.7}
                >
                  {isCurrentDay && <View style={styles.todayDot} />}
                  <Text style={[styles.dayTabNum, active && styles.dayTabNumActive]}>
                    {day.week_day != null ? WEEK_DAYS_SHORT[day.week_day] : `D${day.day_number}`}
                  </Text>
                  <Text style={[styles.dayTabName, active && styles.dayTabNameActive]}>
                    {day.name.length > 8 ? day.name.slice(0, 7) + '.' : day.name.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Indicador de si es el día de hoy */}
          {selectedDay && (
            <View style={styles.dayIndicator}>
              <View style={[styles.dayIndicatorDot, isToday(selectedDay) && styles.dayIndicatorDotActive]} />
              <Text style={styles.dayIndicatorText}>
                {isToday(selectedDay) ? 'HOY ES TU DÍA DE ENTRENAMIENTO' : `TU DÍA ES EL ${selectedDay.week_day != null ? WEEK_DAYS[selectedDay.week_day].toUpperCase() : ''}`}
              </Text>
            </View>
          )}

          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {exercises.map(ex => (
              <TouchableOpacity
                key={ex.id}
                onPress={() => navigation.navigate('WorkoutLog', { exercise: ex, week: currentWeek })}
                activeOpacity={0.7}
              >
                <Card style={styles.exerciseCard}>
                  <View style={styles.exerciseRow}>
                    <View style={styles.exerciseInfo}>
                      {ex.superseries_group && (
                        <Text style={styles.superTag}>🔗 {ex.superseries_group}</Text>
                      )}
                      <Text style={styles.exerciseName}>{ex.name}</Text>
                      <Text style={styles.exerciseMeta}>
                        {ex.reps_objective} reps · 3 series · {ex.unit}
                        {ex.ref_weight ? ` · ref ${ex.ref_weight}${ex.unit}` : ''}
                      </Text>
                    </View>
                    <View style={styles.logBtn}>
                      <Text style={styles.logBtnText}>+</Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}

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

function getCurrentWeek(): number {
  const start = new Date('2025-01-06');
  const now = new Date();
  const diff = Math.floor((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, Math.min(diff + 1, 8));
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: spacing.xl, marginBottom: spacing.lg,
  },
  greeting: { ...typography.label, letterSpacing: 2, color: colors.accent },
  userName: { fontSize: 32, fontWeight: '900', color: colors.textPrimary, letterSpacing: -1, marginTop: 2 },
  weekBadge: {
    width: 52, height: 52, borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  weekBadgeToday: { backgroundColor: colors.accent, borderColor: colors.accent },
  weekBadgeText: { color: colors.background, fontWeight: '900', fontSize: 16 },

  dayTabs: { paddingHorizontal: spacing.xl, gap: spacing.sm, paddingBottom: spacing.sm },
  dayTab: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: 'center', minWidth: 72, position: 'relative',
  },
  dayTabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
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
  dayIndicatorText: { ...typography.caption, letterSpacing: 1.5, color: colors.textMuted },

  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.sm },
  exerciseCard: { },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  exerciseInfo: { flex: 1 },
  superTag: { ...typography.caption, color: colors.accent, marginBottom: 2 },
  exerciseName: { ...typography.h3 },
  exerciseMeta: { ...typography.caption, marginTop: 2 },
  logBtn: {
    width: 40, height: 40, borderRadius: radius.full,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  logBtnText: { color: colors.background, fontSize: 22, fontWeight: '900', lineHeight: 24 },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  emptyTitle: { ...typography.h2, color: colors.textMuted, marginBottom: spacing.sm },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  noExCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  noExTitle: { ...typography.h3, color: colors.textMuted },
  noExText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
