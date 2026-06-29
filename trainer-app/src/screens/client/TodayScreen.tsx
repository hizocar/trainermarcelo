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

export default function TodayScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [days, setDays] = useState<TrainingDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<TrainingDay | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlan();
  }, []);

  useEffect(() => {
    if (selectedDay) fetchExercises(selectedDay.id);
  }, [selectedDay]);

  async function fetchPlan() {
    const { data: planData } = await supabase
      .from('workout_plans')
      .select('*')
      .eq('client_id', user?.id)
      .single();

    if (planData) {
      setPlan(planData);
      const { data: daysData } = await supabase
        .from('training_days')
        .select('*')
        .eq('plan_id', planData.id)
        .order('day_number');
      const activeDays = (daysData ?? []).filter(d => !d.name.toLowerCase().includes('libre'));
      setDays(activeDays);
      if (activeDays.length > 0) setSelectedDay(activeDays[0]);
    }
    setLoading(false);
  }

  async function fetchExercises(dayId: string) {
    const { data } = await supabase
      .from('exercises')
      .select('*')
      .eq('day_id', dayId)
      .order('order_index');
    setExercises(data ?? []);
  }

  const currentWeek = getCurrentWeek();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>SEMANA {currentWeek}</Text>
          <Text style={styles.userName}>{user?.name?.split(' ')[0].toUpperCase()}</Text>
        </View>
        <View style={styles.weekBadge}>
          <Text style={styles.weekBadgeText}>S{currentWeek}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayTabs}
          >
            {days.map(day => (
              <TouchableOpacity
                key={day.id}
                style={[styles.dayTab, selectedDay?.id === day.id && styles.dayTabActive]}
                onPress={() => setSelectedDay(day)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayTabNum, selectedDay?.id === day.id && styles.dayTabNumActive]}>
                  D{day.day_number}
                </Text>
                <Text style={[styles.dayTabName, selectedDay?.id === day.id && styles.dayTabNameActive]}>
                  {day.name.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

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
                      <Text style={styles.exerciseMeta}>{ex.reps_objective} reps · 3 series · {ex.unit}</Text>
                    </View>
                    <View style={styles.logBtn}>
                      <Text style={styles.logBtnText}>+</Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}

            {exercises.length === 0 && (
              <Text style={styles.emptyText}>Sin ejercicios para este día</Text>
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  greeting: {
    ...typography.label,
    letterSpacing: 3,
    color: colors.textMuted,
  },
  userName: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  weekBadge: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekBadgeText: {
    color: colors.background,
    fontWeight: '900',
    fontSize: 16,
  },
  dayTabs: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  dayTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    minWidth: 80,
  },
  dayTabActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  dayTabNum: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: 1,
  },
  dayTabNumActive: { color: colors.background },
  dayTabName: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 2,
  },
  dayTabNameActive: { color: colors.background },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  exerciseCard: { },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exerciseInfo: { flex: 1 },
  superTag: {
    ...typography.caption,
    color: colors.accent,
    marginBottom: 2,
  },
  exerciseName: { ...typography.h3 },
  exerciseMeta: { ...typography.caption, marginTop: 2 },
  logBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logBtnText: {
    color: colors.background,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 24,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
