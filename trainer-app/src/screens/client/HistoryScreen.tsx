import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Exercise, TrainingDay } from '../../types';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';
import WorkoutCalendar, { DayRing } from '../../components/common/WorkoutCalendar';
import { formatShortDate } from '../../lib/weeks';

interface LogRow {
  id: string;
  series_id: string;
  week_number: number;
  weight: number;
  reps: number;
  logged_at: string;
}

interface SeriesRow { id: string; exercise_id: string; series_number: number }

interface Session {
  key: string;
  day: TrainingDay;
  week: number;
  date: string;
  dateKey: string; // YYYY-MM-DD
  exercises: { exercise: Exercise; sets: { seriesNum: number; weight: number; reps: number }[] }[];
}

export default function HistoryScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [days, setDays] = useState<TrainingDay[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useFocusEffect(useCallback(() => { if (user?.id) fetchAll(); }, [user?.id]));

  async function fetchAll() {
    const { data: plan } = await supabase
      .from('workout_plans').select('id').eq('client_id', user!.id).maybeSingle();
    if (!plan) { setLoading(false); return; }

    const { data: daysData } = await supabase
      .from('training_days').select('*').eq('plan_id', plan.id).order('day_number');
    const dayList = daysData ?? [];
    setDays(dayList);

    const { data: exData } = await supabase
      .from('exercises').select('*').in('day_id', dayList.map(d => d.id)).order('order_index');
    const exList = exData ?? [];
    setExercises(exList);

    const { data: sData } = await supabase
      .from('exercise_series').select('id, exercise_id, series_number')
      .in('exercise_id', exList.map(e => e.id));
    const sList = sData ?? [];
    setSeries(sList);

    const { data: lData } = await supabase
      .from('workout_logs').select('id, series_id, week_number, weight, reps, logged_at')
      .in('series_id', sList.map(s => s.id));
    setLogs(lData ?? []);
    setLoading(false);
  }

  const dateKeyOf = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // sesiones (día del plan + semana) con su fecha real
  const sessions = useMemo<Session[]>(() => {
    const seriesById = Object.fromEntries(series.map(s => [s.id, s]));
    const exById = Object.fromEntries(exercises.map(e => [e.id, e]));
    const dayById = Object.fromEntries(days.map(d => [d.id, d]));
    const byKey: Record<string, { day: TrainingDay; week: number; date: string; byEx: Record<string, { seriesNum: number; weight: number; reps: number }[]> }> = {};

    logs.forEach(l => {
      const s = seriesById[l.series_id];
      const ex = s && exById[s.exercise_id];
      const day = ex && dayById[ex.day_id];
      if (!day) return;
      const key = `${day.id}|${l.week_number}`;
      const g = (byKey[key] ??= { day, week: l.week_number, date: l.logged_at, byEx: {} });
      if (l.logged_at < g.date) g.date = l.logged_at;
      (g.byEx[ex.id] ??= []).push({ seriesNum: s.series_number, weight: l.weight, reps: l.reps });
    });

    return Object.entries(byKey).map(([key, g]) => ({
      key, day: g.day, week: g.week, date: g.date, dateKey: dateKeyOf(g.date),
      exercises: exercises
        .filter(e => e.day_id === g.day.id && g.byEx[e.id])
        .map(e => ({ exercise: e, sets: g.byEx[e.id].sort((a, b) => a.seriesNum - b.seriesNum) })),
    })).sort((a, b) => b.date.localeCompare(a.date));
  }, [logs, series, exercises, days]);

  // anillos del calendario: por día, cuántos ejercicios de esa sesión se registraron vs los del plan
  const rings = useMemo<DayRing[]>(() => {
    const exByDay: Record<string, number> = {};
    exercises.forEach(e => { exByDay[e.day_id] = (exByDay[e.day_id] ?? 0) + 1; });
    const byDate: Record<string, { done: number; total: number }> = {};
    sessions.forEach(s => {
      const total = exByDay[s.day.id] || s.exercises.length;
      const prev = byDate[s.dateKey] ?? { done: 0, total: 0 };
      byDate[s.dateKey] = { done: prev.done + s.exercises.length, total: prev.total + total };
    });
    return Object.entries(byDate).map(([date, v]) => ({ date, ratio: v.total ? v.done / v.total : 1 }));
  }, [sessions, exercises]);

  const selectedSessions = useMemo(
    () => sessions.filter(s => s.dateKey === selected),
    [sessions, selected],
  );

  return (
    <View style={embedded ? styles.containerEmbedded : styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {!embedded && (
          <View>
            <Text style={styles.headerLabel}>HISTORIAL</Text>
            <Text style={styles.headerName}>MIS ENTRENAMIENTOS</Text>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : sessions.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>SIN REGISTROS</Text>
            <Text style={styles.emptyText}>Tus entrenamientos aparecerán en el calendario a medida que los registres.</Text>
          </Card>
        ) : (
          <>
            <WorkoutCalendar rings={rings} onSelectDate={setSelected} selectedDate={selected} />

            {selected ? (
              selectedSessions.map(session => (
                <Card key={session.key} style={styles.sessionCard}>
                  <View style={styles.sessionHeader}>
                    <View style={styles.dayBadge}>
                      <Text style={styles.dayBadgeText}>DÍA {session.day.day_number}</Text>
                    </View>
                    <Text style={styles.sessionName}>{session.day.name.toUpperCase()}</Text>
                    <Text style={styles.sessionDate}>{formatShortDate(session.date)}</Text>
                  </View>
                  {session.exercises.map(({ exercise, sets }) => (
                    <TouchableOpacity
                      key={exercise.id}
                      style={styles.exBlock}
                      onPress={() => navigation.navigate('WorkoutLog', { exercise, week: session.week })}
                      activeOpacity={0.7}
                    >
                      <View style={styles.exHeader}>
                        <Text style={styles.exName} numberOfLines={1}>{exercise.name}</Text>
                        <Ionicons name="pencil" size={11} color={colors.accent} />
                      </View>
                      <View style={styles.setsRow}>
                        {sets.map(s => (
                          <View key={s.seriesNum} style={styles.setPill}>
                            <Text style={styles.setPillLabel}>S{s.seriesNum}</Text>
                            <Text style={styles.setPillValue}>{s.weight}{exercise.unit} × {s.reps}</Text>
                          </View>
                        ))}
                      </View>
                    </TouchableOpacity>
                  ))}
                </Card>
              ))
            ) : (
              <Text style={styles.hint}>Toca un día con anillo para ver ese entrenamiento.</Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  containerEmbedded: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
  headerLabel: { ...typography.label, letterSpacing: 3, color: colors.textMuted },
  headerName: { ...typography.display, fontSize: 30 },

  hint: { ...typography.caption, textAlign: 'center', fontStyle: 'italic', marginTop: spacing.sm },

  sessionCard: { gap: spacing.md },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayBadge: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  dayBadgeText: { color: colors.background, fontWeight: '900', fontSize: 10, letterSpacing: 1 },
  sessionName: { ...typography.h3, fontSize: 14, flex: 1 },
  sessionDate: { ...typography.caption, fontSize: 11 },

  exBlock: { gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  exHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  exName: { ...typography.caption, color: colors.textSecondary, fontWeight: '700', flex: 1 },
  setsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  setPill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.surface, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.border,
  },
  setPillLabel: { fontSize: 9, fontWeight: '900', color: colors.accent },
  setPillValue: { fontSize: 11, color: colors.textPrimary, fontWeight: '600' },

  emptyCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyTitle: { ...typography.h3, color: colors.textMuted },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
