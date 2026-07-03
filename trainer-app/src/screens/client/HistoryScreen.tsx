import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Exercise, TrainingDay } from '../../types';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';
import { WEEK_DAYS_SHORT, getCurrentWeek } from '../../lib/weeks';

interface LogRow {
  id: string;
  series_id: string;
  week_number: number;
  weight: number;
  reps: number;
}

interface SeriesRow {
  id: string;
  exercise_id: string;
  series_number: number;
}

export default function HistoryScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [days, setDays] = useState<TrainingDay[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // recargar al volver de editar un registro
  useFocusEffect(useCallback(() => { if (user?.id) fetchAll(); }, [user?.id]));

  async function fetchAll() {
    const { data: plan } = await supabase
      .from('workout_plans').select('id')
      .eq('client_id', user!.id).maybeSingle();
    if (!plan) { setLoading(false); return; }

    const { data: daysData } = await supabase
      .from('training_days').select('*')
      .eq('plan_id', plan.id).order('week_day', { nullsFirst: false });
    const dayList = daysData ?? [];
    setDays(dayList);

    const { data: exData } = await supabase
      .from('exercises').select('*')
      .in('day_id', dayList.map(d => d.id))
      .order('order_index');
    const exList = exData ?? [];
    setExercises(exList);

    const { data: sData } = await supabase
      .from('exercise_series').select('id, exercise_id, series_number')
      .in('exercise_id', exList.map(e => e.id));
    const sList = sData ?? [];
    setSeries(sList);

    const { data: lData } = await supabase
      .from('workout_logs')
      .select('id, series_id, week_number, weight, reps')
      .in('series_id', sList.map(s => s.id));
    setLogs(lData ?? []);
    setLoading(false);
  }

  const weeks = useMemo(
    () => [...new Set(logs.map(l => l.week_number))].sort((a, b) => b - a),
    [logs],
  );
  const week = selectedWeek ?? weeks[0] ?? null;

  // logs de la semana agrupados por ejercicio, ordenados por día y orden del plan
  const weekData = useMemo(() => {
    if (week == null) return [];
    const seriesById = Object.fromEntries(series.map(s => [s.id, s]));
    const byExercise: Record<string, { seriesNum: number; weight: number; reps: number }[]> = {};
    logs.filter(l => l.week_number === week).forEach(l => {
      const s = seriesById[l.series_id];
      if (!s) return;
      (byExercise[s.exercise_id] ??= []).push({ seriesNum: s.series_number, weight: l.weight, reps: l.reps });
    });

    return days.map(day => ({
      day,
      exercises: exercises
        .filter(e => e.day_id === day.id && byExercise[e.id])
        .map(e => ({
          exercise: e,
          sets: byExercise[e.id].sort((a, b) => a.seriesNum - b.seriesNum),
        })),
    })).filter(g => g.exercises.length > 0);
  }, [week, logs, series, exercises, days]);

  const currentWeek = getCurrentWeek();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.headerLabel}>HISTORIAL</Text>
          <Text style={styles.headerName}>MIS REGISTROS</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : weeks.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="time-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>SIN REGISTROS</Text>
            <Text style={styles.emptyText}>Cuando registres entrenamientos, aparecerán aquí para revisarlos y corregirlos.</Text>
          </Card>
        ) : (
          <>
            {/* selector de semana */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.weekChips}>
              {weeks.map(w => {
                const active = w === week;
                return (
                  <TouchableOpacity
                    key={w}
                    style={[styles.weekChip, active && styles.weekChipActive]}
                    onPress={() => setSelectedWeek(w)}
                  >
                    <Text style={[styles.weekChipText, active && styles.weekChipTextActive]}>
                      SEMANA {w}{w === currentWeek ? ' · ACTUAL' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {weekData.map(({ day, exercises: exs }) => (
              <View key={day.id} style={styles.dayBlock}>
                <View style={styles.dayHeader}>
                  <View style={styles.dayBadge}>
                    <Text style={styles.dayBadgeText}>
                      {day.week_day != null ? WEEK_DAYS_SHORT[day.week_day].toUpperCase() : `D${day.day_number}`}
                    </Text>
                  </View>
                  <Text style={styles.dayName}>{day.name.toUpperCase()}</Text>
                </View>

                {exs.map(({ exercise, sets }) => (
                  <TouchableOpacity
                    key={exercise.id}
                    onPress={() => navigation.navigate('WorkoutLog', { exercise, week })}
                    activeOpacity={0.7}
                  >
                    <Card style={styles.exCard}>
                      <View style={styles.exHeader}>
                        <Text style={styles.exName}>{exercise.name}</Text>
                        <View style={styles.editHint}>
                          <Ionicons name="pencil" size={12} color={colors.accent} />
                          <Text style={styles.editHintText}>EDITAR</Text>
                        </View>
                      </View>
                      <View style={styles.setsRow}>
                        {sets.map(s => (
                          <View key={s.seriesNum} style={styles.setPill}>
                            <Text style={styles.setPillLabel}>S{s.seriesNum}</Text>
                            <Text style={styles.setPillValue}>
                              {s.weight}{exercise.unit} × {s.reps}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </Card>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
  headerLabel: { ...typography.label, letterSpacing: 3, color: colors.textMuted },
  headerName: { ...typography.display, fontSize: 30 },

  weekChips: { gap: spacing.sm },
  weekChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  weekChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  weekChipText: { ...typography.caption, fontWeight: '800', letterSpacing: 1, color: colors.textMuted },
  weekChipTextActive: { color: colors.background },

  dayBlock: { gap: spacing.sm },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  dayBadge: {
    backgroundColor: colors.accentSoft, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.accent + '44',
  },
  dayBadgeText: { color: colors.accent, fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  dayName: { ...typography.h3 },

  exCard: { gap: spacing.sm },
  exHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  exName: { ...typography.h3, fontSize: 15, flex: 1 },
  editHint: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editHintText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, color: colors.accent },
  setsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  setPill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.surface, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  setPillLabel: { fontSize: 10, fontWeight: '900', color: colors.accent },
  setPillValue: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },

  emptyCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyTitle: { ...typography.h3, color: colors.textMuted },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
