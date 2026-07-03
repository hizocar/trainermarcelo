import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { User } from '../../types';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';
import StatCard from '../../components/common/StatCard';
import VolumeChart from '../../components/common/VolumeChart';
import TrendChart from '../../components/common/TrendChart';

type RouteParams = { client?: User; clientId?: string; clientName?: string };

interface LogRow {
  series_id: string;
  week_number: number;
  weight: number;
  reps: number;
}

interface ExerciseInfo {
  id: string;
  name: string;
  unit: string;
}

const MAX_BARS = 10;

export default function ProgressScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const params = (route.params ?? {}) as RouteParams;
  const { user } = useAuth();

  const targetId = params.client?.id ?? params.clientId ?? user?.id ?? '';
  const targetName = params.client?.name ?? params.clientName ?? user?.name ?? '';
  const isCoachView = !!(params.client || params.clientId);

  const [logs, setLogs] = useState<LogRow[]>([]);
  const [exercises, setExercises] = useState<ExerciseInfo[]>([]);
  const [seriesExMap, setSeriesExMap] = useState<Record<string, string>>({});
  const [selectedEx, setSelectedEx] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (targetId) fetchData();
  }, [targetId]);

  async function fetchData() {
    setLoading(true);
    const { data: plan } = await supabase
      .from('workout_plans')
      .select('id')
      .eq('client_id', targetId)
      .maybeSingle();

    if (!plan) { setLoading(false); return; }

    const { data: days } = await supabase
      .from('training_days')
      .select('id')
      .eq('plan_id', plan.id);

    const dayIds = (days ?? []).map(d => d.id);
    if (dayIds.length === 0) { setLoading(false); return; }

    const { data: exs } = await supabase
      .from('exercises')
      .select('id, name, unit')
      .in('day_id', dayIds)
      .order('order_index');

    const exList = exs ?? [];
    setExercises(exList);

    const { data: series } = await supabase
      .from('exercise_series')
      .select('id, exercise_id')
      .in('exercise_id', exList.map(e => e.id));

    const sMap: Record<string, string> = {};
    (series ?? []).forEach(s => { sMap[s.id] = s.exercise_id; });
    setSeriesExMap(sMap);

    const { data: logsData } = await supabase
      .from('workout_logs')
      .select('series_id, week_number, weight, reps')
      .in('series_id', Object.keys(sMap));

    setLogs(logsData ?? []);
    setLoading(false);
  }

  const unitMap = useMemo(() => {
    const m: Record<string, string> = {};
    exercises.forEach(e => { m[e.id] = e.unit; });
    return m;
  }, [exercises]);

  const toKg = (log: LogRow) => {
    const unit = unitMap[seriesExMap[log.series_id]] ?? 'kg';
    return log.weight * (unit === 'lb' ? 0.453592 : 1);
  };

  // ── Volumen semanal (solo semanas con datos) ──────────────────────────────
  const weeklyVolume = useMemo(() => {
    const byWeek: Record<number, number> = {};
    logs.forEach(l => {
      byWeek[l.week_number] = (byWeek[l.week_number] ?? 0) + toKg(l) * l.reps;
    });
    return Object.entries(byWeek)
      .map(([w, v]) => ({ week: Number(w), volume: Math.round(v) }))
      .sort((a, b) => a.week - b.week);
  }, [logs, unitMap, seriesExMap]);

  // ── Stats generales ───────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalVolume = weeklyVolume.reduce((acc, w) => acc + w.volume, 0);
    const totalSets = logs.length;
    const best = weeklyVolume.reduce(
      (acc, w) => (w.volume > acc.volume ? w : acc),
      { week: 0, volume: 0 },
    );
    return { totalVolume, totalSets, best, weeks: weeklyVolume.length };
  }, [weeklyVolume, logs]);

  // ── Tendencia por ejercicio: peso máximo por semana ───────────────────────
  const exercisesWithData = useMemo(
    () => exercises.filter(e => logs.some(l => seriesExMap[l.series_id] === e.id)),
    [exercises, logs, seriesExMap],
  );
  const activeEx = selectedEx ?? exercisesWithData[0]?.id ?? null;

  const exerciseTrend = useMemo(() => {
    if (!activeEx) return [];
    const byWeek: Record<number, number> = {};
    logs.forEach(l => {
      if (seriesExMap[l.series_id] !== activeEx) return;
      byWeek[l.week_number] = Math.max(byWeek[l.week_number] ?? 0, l.weight);
    });
    return Object.entries(byWeek)
      .map(([w, v]) => ({ week: Number(w), value: v }))
      .sort((a, b) => a.week - b.week)
      .map(({ week, value }) => ({ label: `S${week}`, value }));
  }, [activeEx, logs, seriesExMap]);

  // ── Récords personales (mejor peso por ejercicio) ─────────────────────────
  const personalRecords = useMemo(() => {
    const best: Record<string, { weight: number; reps: number; week: number }> = {};
    logs.forEach(l => {
      const exId = seriesExMap[l.series_id];
      if (!exId) return;
      if (!best[exId] || l.weight > best[exId].weight) {
        best[exId] = { weight: l.weight, reps: l.reps, week: l.week_number };
      }
    });
    return exercises
      .filter(e => best[e.id])
      .map(e => ({ exercise: e, ...best[e.id] }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5);
  }, [logs, exercises, seriesExMap]);

  const barData = weeklyVolume.slice(-MAX_BARS).map(w => ({
    value: w.volume,
    label: `S${w.week}`,
    frontColor: colors.accent,
  }));
  const maxVolume = Math.max(...weeklyVolume.map(w => w.volume), 1);
  const hasData = logs.length > 0;
  const activeExInfo = exercises.find(e => e.id === activeEx);

  return (
    <View style={styles.container}>
      {isCoachView && (
        <View style={styles.navHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={16} color={colors.textMuted} />
            <Text style={styles.backText}>ATRÁS</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerLabel}>PROGRESO</Text>
          <Text style={styles.headerName}>{targetName.toUpperCase()}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : hasData ? (
          <>
            {/* Stats */}
            <View style={styles.statsRow}>
              <StatCard
                accent
                label="VOLUMEN TOTAL"
                value={`${(stats.totalVolume / 1000).toFixed(1)}t`}
                sublabel={`${stats.totalVolume.toLocaleString()} kg`}
              />
              <StatCard label="SERIES" value={`${stats.totalSets}`} sublabel={`${stats.weeks} semanas`} />
              <StatCard
                label="MEJOR SEMANA"
                value={`S${stats.best.week}`}
                sublabel={`${stats.best.volume.toLocaleString()} kg`}
              />
            </View>

            {/* Volumen semanal */}
            <Card style={styles.chartCard}>
              <Text style={styles.chartTitle}>VOLUMEN SEMANAL</Text>
              <Text style={styles.chartSub}>Peso × reps, en kg — últimas {barData.length} semanas con registros</Text>
              <View style={styles.chart}>
                <VolumeChart data={barData} maxVolume={maxVolume} />
              </View>
            </Card>

            {/* Tendencia por ejercicio */}
            {exercisesWithData.length > 0 && (
              <Card style={styles.chartCard}>
                <Text style={styles.chartTitle}>PESO MÁXIMO POR EJERCICIO</Text>
                <Text style={styles.chartSub}>Mejor serie de cada semana</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.exChips}>
                  {exercisesWithData.map(e => {
                    const active = activeEx === e.id;
                    return (
                      <TouchableOpacity
                        key={e.id}
                        style={[styles.exChip, active && styles.exChipActive]}
                        onPress={() => setSelectedEx(e.id)}
                      >
                        <Text style={[styles.exChipText, active && styles.exChipTextActive]} numberOfLines={1}>
                          {e.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                {activeEx && (
                  <TrendChart data={exerciseTrend} unit={activeExInfo?.unit ?? 'kg'} />
                )}
              </Card>
            )}

            {/* Récords personales */}
            {personalRecords.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>RÉCORDS PERSONALES</Text>
                {personalRecords.map((pr, i) => (
                  <Card key={pr.exercise.id} style={styles.prRow}>
                    <View style={styles.prRank}>
                      <Ionicons
                        name={i === 0 ? 'trophy' : 'medal-outline'}
                        size={18}
                        color={i === 0 ? colors.accent : colors.textMuted}
                      />
                    </View>
                    <View style={styles.prInfo}>
                      <Text style={styles.prName}>{pr.exercise.name}</Text>
                      <Text style={styles.prMeta}>Semana {pr.week} · {pr.reps} reps</Text>
                    </View>
                    <Text style={styles.prWeight}>{pr.weight} {pr.exercise.unit}</Text>
                  </Card>
                ))}
              </>
            )}
          </>
        ) : (
          <Card style={styles.emptyCard}>
            <Ionicons name="stats-chart-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>SIN DATOS AÚN</Text>
            <Text style={styles.emptyText}>
              {isCoachView
                ? 'Este cliente aún no registra entrenamientos.'
                : 'Registra tu primer entrenamiento para ver tu progreso aquí.'}
            </Text>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 60,
  },
  navHeader: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  backBtn: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  header: {
    marginBottom: spacing.sm,
  },
  headerLabel: {
    ...typography.label,
    letterSpacing: 3,
    color: colors.textMuted,
  },
  headerName: { ...typography.display },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  chartCard: { gap: spacing.sm },
  chartTitle: { ...typography.h3 },
  chartSub: { ...typography.caption },
  chart: { marginTop: spacing.sm },
  exChips: { gap: spacing.sm, paddingVertical: spacing.xs },
  exChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    maxWidth: 180,
  },
  exChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  exChipText: { ...typography.caption, fontWeight: '700', color: colors.textMuted },
  exChipTextActive: { color: colors.background },
  sectionLabel: {
    ...typography.label,
    letterSpacing: 3,
    marginTop: spacing.sm,
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  prRank: { width: 28, alignItems: 'center' },
  prInfo: { flex: 1 },
  prName: { ...typography.h3, fontSize: 15 },
  prMeta: { ...typography.caption, marginTop: 2 },
  prWeight: { fontSize: 18, fontWeight: '900', color: colors.accent },
  emptyCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyTitle: { ...typography.h3, color: colors.textMuted },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
