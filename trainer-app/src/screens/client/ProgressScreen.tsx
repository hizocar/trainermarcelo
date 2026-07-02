import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { WeeklyVolume } from '../../types';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';
import VolumeChart from '../../components/common/VolumeChart';

type RouteParams = { clientId?: string; clientName?: string };

export default function ProgressScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const params = (route.params ?? {}) as RouteParams;
  const { user } = useAuth();

  const targetId = params.clientId ?? user?.id ?? '';
  const targetName = params.clientName ?? user?.name ?? '';

  const [weeklyVolume, setWeeklyVolume] = useState<WeeklyVolume[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (targetId) fetchVolume();
  }, [targetId]);

  async function fetchVolume() {
    const { data: plan } = await supabase
      .from('workout_plans')
      .select('id')
      .eq('client_id', targetId)
      .single();

    if (!plan) { setLoading(false); return; }

    const { data: days } = await supabase
      .from('training_days')
      .select('id')
      .eq('plan_id', plan.id);

    const dayIds = (days ?? []).map(d => d.id);

    const { data: exs } = await supabase
      .from('exercises')
      .select('id, unit')
      .in('day_id', dayIds);

    const exIds = (exs ?? []).map(e => e.id);
    const unitMap: Record<string, string> = {};
    (exs ?? []).forEach(e => { unitMap[e.id] = e.unit; });

    const { data: series } = await supabase
      .from('exercise_series')
      .select('id, exercise_id')
      .in('exercise_id', exIds);

    const seriesIds = (series ?? []).map(s => s.id);
    const seriesExMap: Record<string, string> = {};
    (series ?? []).forEach(s => { seriesExMap[s.id] = s.exercise_id; });

    const { data: logs } = await supabase
      .from('workout_logs')
      .select('series_id, week_number, weight, reps')
      .in('series_id', seriesIds);

    const volumeByWeek: Record<number, number> = {};
    (logs ?? []).forEach(log => {
      const exId = seriesExMap[log.series_id];
      const unit = unitMap[exId] ?? 'kg';
      const factor = unit === 'lb' ? 0.453592 : 1;
      const v = log.weight * log.reps * factor;
      volumeByWeek[log.week_number] = (volumeByWeek[log.week_number] ?? 0) + v;
    });

    const result: WeeklyVolume[] = Array.from({ length: 8 }, (_, i) => ({
      week: i + 1,
      volume: Math.round(volumeByWeek[i + 1] ?? 0),
    }));

    setWeeklyVolume(result);
    setLoading(false);
  }

  const chartData = weeklyVolume.map(w => ({
    value: w.volume,
    label: `S${w.week}`,
    frontColor: w.volume > 0 ? colors.accent : colors.border,
  }));

  const maxVolume = Math.max(...weeklyVolume.map(w => w.volume), 1);
  const hasData = weeklyVolume.some(w => w.volume > 0);

  return (
    <View style={styles.container}>
      {params.clientId && (
        <View style={styles.navHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← ATRÁS</Text>
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
            <Card style={styles.chartCard}>
              <Text style={styles.chartTitle}>VOLUMEN SEMANAL (kg)</Text>
              <Text style={styles.chartSub}>Peso × Reps por semana</Text>
              <View style={styles.chart}>
                <VolumeChart data={chartData} maxVolume={maxVolume} />
              </View>
            </Card>

            <Text style={styles.sectionLabel}>RESUMEN SEMANAS</Text>
            {weeklyVolume.filter(w => w.volume > 0).map(w => (
              <Card key={w.week} style={styles.weekRow}>
                <View style={styles.weekLeft}>
                  <Text style={styles.weekLabel}>SEMANA {w.week}</Text>
                  <View style={[styles.volumeBar, { width: `${(w.volume / maxVolume) * 100}%` }]} />
                </View>
                <Text style={styles.weekVolume}>{w.volume.toLocaleString()} kg</Text>
              </Card>
            ))}
          </>
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>SIN DATOS AÚN</Text>
            <Text style={styles.emptyText}>Registra tu primer entrenamiento para ver tu progreso aquí.</Text>
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
  backBtn: { alignSelf: 'flex-start' },
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
  headerName: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  chartCard: { gap: spacing.sm },
  chartTitle: { ...typography.h3 },
  chartSub: { ...typography.caption },
  chart: { marginTop: spacing.sm, marginLeft: -spacing.sm },
  sectionLabel: {
    ...typography.label,
    letterSpacing: 3,
    marginTop: spacing.sm,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  weekLeft: { flex: 1, gap: 4 },
  weekLabel: { ...typography.caption, letterSpacing: 2 },
  volumeBar: {
    height: 4,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    minWidth: 8,
  },
  weekVolume: { ...typography.h3, color: colors.accent },
  emptyCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyTitle: { ...typography.h3, color: colors.textMuted },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
