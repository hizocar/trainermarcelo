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
import { formatShortDate, formatMonthYear } from '../../lib/weeks';

interface LogRow {
  id: string;
  series_id: string;
  week_number: number;
  weight: number;
  reps: number;
  logged_at: string;
}

interface SeriesRow {
  id: string;
  exercise_id: string;
  series_number: number;
}

// Una sesión = un día del plan entrenado en una semana concreta, con su fecha real
interface Session {
  key: string;
  day: TrainingDay;
  week: number;
  date: string; // logged_at más antiguo de la sesión
  exercises: { exercise: Exercise; sets: { seriesNum: number; weight: number; reps: number }[] }[];
}

export default function HistoryScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [days, setDays] = useState<TrainingDay[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
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
      .eq('plan_id', plan.id).order('day_number');
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
      .select('id, series_id, week_number, weight, reps, logged_at')
      .in('series_id', sList.map(s => s.id));
    setLogs(lData ?? []);
    setLoading(false);
  }

  // ── sesiones ordenadas por fecha real (más reciente primero) ──────────────
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

    return Object.entries(byKey)
      .map(([key, g]) => ({
        key,
        day: g.day,
        week: g.week,
        date: g.date,
        exercises: exercises
          .filter(e => e.day_id === g.day.id && g.byEx[e.id])
          .map(e => ({ exercise: e, sets: g.byEx[e.id].sort((a, b) => a.seriesNum - b.seriesNum) })),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [logs, series, exercises, days]);

  // agrupar por mes para los separadores
  const sections = useMemo(() => {
    const out: { month: string; sessions: Session[] }[] = [];
    sessions.forEach(s => {
      const month = formatMonthYear(s.date);
      const last = out[out.length - 1];
      if (last && last.month === month) last.sessions.push(s);
      else out.push({ month, sessions: [s] });
    });
    return out;
  }, [sessions]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.headerLabel}>HISTORIAL</Text>
          <Text style={styles.headerName}>MIS ENTRENAMIENTOS</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : sessions.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="time-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>SIN REGISTROS</Text>
            <Text style={styles.emptyText}>Cuando registres entrenamientos, aparecerán aquí ordenados por fecha.</Text>
          </Card>
        ) : (
          sections.map(section => (
            <View key={section.month} style={styles.monthBlock}>
              <Text style={styles.monthLabel}>{section.month.toUpperCase()}</Text>

              {section.sessions.map(session => (
                <Card key={session.key} style={styles.sessionCard}>
                  <View style={styles.sessionHeader}>
                    <View style={styles.dayBadge}>
                      <Text style={styles.dayBadgeText}>DÍA {session.day.day_number}</Text>
                    </View>
                    <Text style={styles.sessionName}>{session.day.name.toUpperCase()}</Text>
                    <View style={styles.sessionDate}>
                      <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
                      <Text style={styles.sessionDateText}>{formatShortDate(session.date)}</Text>
                    </View>
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
                        <View style={styles.editHint}>
                          <Ionicons name="pencil" size={11} color={colors.accent} />
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
                    </TouchableOpacity>
                  ))}
                </Card>
              ))}
            </View>
          ))
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

  monthBlock: { gap: spacing.sm },
  monthLabel: { ...typography.label, letterSpacing: 3, marginTop: spacing.sm },

  sessionCard: { gap: spacing.md },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayBadge: {
    backgroundColor: colors.accent, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  dayBadgeText: { color: colors.background, fontWeight: '900', fontSize: 10, letterSpacing: 1 },
  sessionName: { ...typography.h3, fontSize: 14, flex: 1 },
  sessionDate: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sessionDateText: { ...typography.caption, fontSize: 11 },

  exBlock: {
    gap: spacing.xs,
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  exHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  exName: { ...typography.caption, color: colors.textSecondary, fontWeight: '700', flex: 1 },
  editHint: { padding: 2 },
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
