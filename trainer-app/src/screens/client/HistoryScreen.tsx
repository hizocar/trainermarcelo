import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput,
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

export default function HistoryScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [days, setDays] = useState<TrainingDay[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filterDay, setFilterDay] = useState<number | null>(null);

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

  // búsqueda por ejercicio, nombre de día o fecha; filtro por día del plan
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const filteredSessions = useMemo(() => {
    let out = sessions;
    if (filterDay != null) out = out.filter(s => s.day.day_number === filterDay);
    const q = norm(query.trim());
    if (q) {
      out = out
        .map(s => {
          const dateText = norm(formatShortDate(s.date) + ' ' + formatMonthYear(s.date));
          const sessionMatches = norm(s.day.name).includes(q) || dateText.includes(q);
          const exs = sessionMatches
            ? s.exercises
            : s.exercises.filter(e => norm(e.exercise.name).includes(q));
          return { ...s, exercises: exs };
        })
        .filter(s => s.exercises.length > 0);
    }
    return out;
  }, [sessions, query, filterDay]);

  // agrupar por mes para los separadores
  const sections = useMemo(() => {
    const out: { month: string; sessions: Session[] }[] = [];
    filteredSessions.forEach(s => {
      const month = formatMonthYear(s.date);
      const last = out[out.length - 1];
      if (last && last.month === month) last.sessions.push(s);
      else out.push({ month, sessions: [s] });
    });
    return out;
  }, [filteredSessions]);

  return (
    <View style={embedded ? styles.containerEmbedded : styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {!embedded && (
          <View>
            <Text style={styles.headerLabel}>HISTORIAL</Text>
            <Text style={styles.headerName}>MIS ENTRENAMIENTOS</Text>
          </View>
        )}

        {!loading && sessions.length > 0 && (
          <>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar ejercicio, día o fecha..."
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.dayChips}>
              <TouchableOpacity
                style={[styles.dayChip, filterDay == null && styles.dayChipActive]}
                onPress={() => setFilterDay(null)}
              >
                <Text style={[styles.dayChipText, filterDay == null && styles.dayChipTextActive]}>TODOS</Text>
              </TouchableOpacity>
              {days.map(d => (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.dayChip, filterDay === d.day_number && styles.dayChipActive]}
                  onPress={() => setFilterDay(filterDay === d.day_number ? null : d.day_number)}
                >
                  <Text style={[styles.dayChipText, filterDay === d.day_number && styles.dayChipTextActive]}>
                    DÍA {d.day_number} · {d.name.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : sessions.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="time-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>SIN REGISTROS</Text>
            <Text style={styles.emptyText}>Cuando registres entrenamientos, aparecerán aquí ordenados por fecha.</Text>
          </Card>
        ) : sections.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="search-outline" size={32} color={colors.textMuted} />
            <Text style={styles.emptyText}>Nada coincide con tu búsqueda.</Text>
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
  containerEmbedded: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
  headerLabel: { ...typography.label, letterSpacing: 3, color: colors.textMuted },
  headerName: { ...typography.display, fontSize: 30 },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14, padding: 0 },
  dayChips: { gap: spacing.sm },
  dayChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dayChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayChipText: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: colors.textMuted },
  dayChipTextActive: { color: colors.background },

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
