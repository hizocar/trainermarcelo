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
import TrendChart from '../../components/common/TrendChart';
import { getCurrentWeek } from '../../lib/weeks';

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

// Fuerza estimada (1RM Epley): captura mejoras de peso Y de reps en un solo número
const score = (weight: number, reps: number) => weight * (1 + reps / 30);

interface ExProgress {
  exercise: ExerciseInfo;
  points: { week: number; score: number }[];
  delta: number | null;      // % vs semana anterior con datos
  lastWeek: number;
  best: { weight: number; reps: number; week: number };
}

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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (targetId) fetchData();
  }, [targetId]);

  async function fetchData() {
    setLoading(true);
    const { data: plan } = await supabase
      .from('workout_plans').select('id')
      .eq('client_id', targetId).maybeSingle();
    if (!plan) { setLoading(false); return; }

    const { data: days } = await supabase
      .from('training_days').select('id').eq('plan_id', plan.id);
    const dayIds = (days ?? []).map(d => d.id);
    if (dayIds.length === 0) { setLoading(false); return; }

    const { data: exs } = await supabase
      .from('exercises').select('id, name, unit')
      .in('day_id', dayIds).order('order_index');
    setExercises(exs ?? []);

    const { data: series } = await supabase
      .from('exercise_series').select('id, exercise_id')
      .in('exercise_id', (exs ?? []).map(e => e.id));
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

  // La semana en curso se excluye de todos los cálculos: parcial, distorsiona.
  // Se suma automáticamente cuando termina (getCurrentWeek avanza).
  const currentWeek = getCurrentWeek();
  const closedLogs = useMemo(
    () => logs.filter(l => l.week_number < currentWeek),
    [logs, currentWeek],
  );
  const hasCurrentWeekLogs = logs.length > closedLogs.length;

  // ── progresión por ejercicio ──────────────────────────────────────────────
  const progress = useMemo<ExProgress[]>(() => {
    const byEx: Record<string, Record<number, LogRow[]>> = {};
    closedLogs.forEach(l => {
      const exId = seriesExMap[l.series_id];
      if (!exId) return;
      ((byEx[exId] ??= {})[l.week_number] ??= []).push(l);
    });

    return exercises
      .filter(e => byEx[e.id])
      .map(e => {
        const weeks = Object.keys(byEx[e.id]).map(Number).sort((a, b) => a - b);
        const points = weeks.map(w => ({
          week: w,
          score: Math.max(...byEx[e.id][w].map(l => score(l.weight, l.reps))),
        }));
        const last = points[points.length - 1];
        const prev = points.length > 1 ? points[points.length - 2] : null;
        const delta = prev ? ((last.score - prev.score) / prev.score) * 100 : null;

        let best = { weight: 0, reps: 0, week: 0 };
        weeks.forEach(w => byEx[e.id][w].forEach(l => {
          if (score(l.weight, l.reps) > score(best.weight, best.reps)) {
            best = { weight: l.weight, reps: l.reps, week: w };
          }
        }));

        return { exercise: e, points, delta, lastWeek: last.week, best };
      });
  }, [closedLogs, exercises, seriesExMap]);

  const improving = progress.filter(p => p.delta != null && p.delta > 1)
    .sort((a, b) => b.delta! - a.delta!);
  const steady = progress.filter(p => p.delta != null && p.delta >= -1 && p.delta <= 1);
  const declining = progress.filter(p => p.delta != null && p.delta < -1)
    .sort((a, b) => a.delta! - b.delta!);
  const noHistory = progress.filter(p => p.delta == null);

  // ── volumen semanal (para la línea del resumen) ───────────────────────────
  const weeklyVolume = useMemo(() => {
    const byWeek: Record<number, number> = {};
    closedLogs.forEach(l => {
      byWeek[l.week_number] = (byWeek[l.week_number] ?? 0) + l.weight * l.reps;
    });
    return Object.entries(byWeek)
      .map(([w, v]) => ({ week: Number(w), volume: Math.round(v) }))
      .sort((a, b) => a.week - b.week);
  }, [closedLogs]);

  const volDelta = useMemo(() => {
    if (weeklyVolume.length < 2) return null;
    const last = weeklyVolume[weeklyVolume.length - 1].volume;
    const prev = weeklyVolume[weeklyVolume.length - 2].volume;
    return ((last - prev) / prev) * 100;
  }, [weeklyVolume]);

  const hasData = closedLogs.length > 0;
  const comparable = improving.length + steady.length + declining.length;

  const fmtDelta = (d: number) => `${d > 0 ? '+' : ''}${Math.round(d)}%`;

  function renderRow(p: ExProgress, tone: 'up' | 'flat' | 'down') {
    const open = expanded === p.exercise.id;
    const toneColor = tone === 'up' ? colors.success : tone === 'down' ? colors.danger : colors.textMuted;
    return (
      <Card key={p.exercise.id} style={styles.exRow}>
        <TouchableOpacity
          style={styles.exRowHeader}
          onPress={() => setExpanded(open ? null : p.exercise.id)}
          activeOpacity={0.7}
        >
          <View style={styles.exRowInfo}>
            <Text style={styles.exRowName} numberOfLines={1}>{p.exercise.name}</Text>
            <Text style={styles.exRowMeta}>
              Mejor: {p.best.weight}{p.exercise.unit} × {p.best.reps} (S{p.best.week})
            </Text>
          </View>
          {p.delta != null && (
            <View style={[styles.deltaBadge, { borderColor: toneColor }]}>
              <Ionicons
                name={tone === 'up' ? 'trending-up' : tone === 'down' ? 'trending-down' : 'remove'}
                size={13} color={toneColor}
              />
              <Text style={[styles.deltaText, { color: toneColor }]}>{fmtDelta(p.delta)}</Text>
            </View>
          )}
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={colors.textMuted} />
        </TouchableOpacity>

        {open && (
          <View style={styles.exRowChart}>
            <Text style={styles.chartCaption}>FUERZA ESTIMADA POR SEMANA ({p.exercise.unit})</Text>
            <TrendChart
              data={p.points.map(pt => ({ label: `S${pt.week}`, value: Math.round(pt.score * 10) / 10 }))}
              height={150}
              unit={p.exercise.unit}
            />
          </View>
        )}
      </Card>
    );
  }

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
        <View>
          <Text style={styles.headerLabel}>PROGRESO</Text>
          <Text style={styles.headerName}>{targetName.toUpperCase()}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : !hasData ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="stats-chart-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>SIN DATOS AÚN</Text>
            <Text style={styles.emptyText}>
              {isCoachView
                ? 'Este cliente aún no registra entrenamientos.'
                : 'Registra tu primer entrenamiento para ver tu progreso aquí.'}
            </Text>
          </Card>
        ) : (
          <>
            {/* Resumen de evolución */}
            <Card style={styles.summaryCard}>
              <View style={styles.summaryTop}>
                <View style={styles.summaryStat}>
                  <Text style={[styles.summaryValue, { color: colors.success }]}>{improving.length}</Text>
                  <Text style={styles.summaryLabel}>MEJORANDO</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryValue}>{steady.length}</Text>
                  <Text style={styles.summaryLabel}>MANTENIENDO</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryStat}>
                  <Text style={[styles.summaryValue, { color: colors.danger }]}>{declining.length}</Text>
                  <Text style={styles.summaryLabel}>POR MEJORAR</Text>
                </View>
              </View>

              {comparable > 0 && (
                <View style={styles.summaryBarTrack}>
                  {improving.length > 0 && <View style={[styles.summaryBarSeg, { flex: improving.length, backgroundColor: colors.success }]} />}
                  {steady.length > 0 && <View style={[styles.summaryBarSeg, { flex: steady.length, backgroundColor: colors.textMuted }]} />}
                  {declining.length > 0 && <View style={[styles.summaryBarSeg, { flex: declining.length, backgroundColor: colors.danger }]} />}
                </View>
              )}

              {volDelta != null && (
                <Text style={styles.volLine}>
                  Volumen S{weeklyVolume[weeklyVolume.length - 1].week}:{' '}
                  <Text style={{ color: volDelta >= 0 ? colors.success : colors.danger, fontWeight: '800' }}>
                    {fmtDelta(volDelta)}
                  </Text>{' '}
                  vs S{weeklyVolume[weeklyVolume.length - 2].week}
                </Text>
              )}

              {weeklyVolume.length >= 2 && (
                <TrendChart
                  data={weeklyVolume.map(w => ({ label: `S${w.week}`, value: w.volume }))}
                  height={120}
                />
              )}

              {hasCurrentWeekLogs && (
                <Text style={styles.currentWeekNote}>
                  ⏳ La semana en curso se sumará al gráfico cuando termine
                </Text>
              )}
            </Card>

            {improving.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Ionicons name="trending-up" size={14} color={colors.success} />
                  <Text style={[styles.sectionLabel, { color: colors.success }]}>MEJORANDO</Text>
                </View>
                {improving.map(p => renderRow(p, 'up'))}
              </>
            )}

            {declining.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Ionicons name="trending-down" size={14} color={colors.danger} />
                  <Text style={[styles.sectionLabel, { color: colors.danger }]}>POR MEJORAR</Text>
                </View>
                {declining.map(p => renderRow(p, 'down'))}
              </>
            )}

            {steady.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Ionicons name="remove" size={14} color={colors.textMuted} />
                  <Text style={styles.sectionLabel}>MANTENIENDO</Text>
                </View>
                {steady.map(p => renderRow(p, 'flat'))}
              </>
            )}

            {noHistory.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Ionicons name="hourglass-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.sectionLabel}>AÚN SIN COMPARACIÓN</Text>
                </View>
                <Text style={styles.noHistoryText}>
                  {noHistory.map(p => p.exercise.name).join(' · ')}
                </Text>
                <Text style={styles.noHistoryHint}>
                  Registra estos ejercicios una semana más para ver su tendencia.
                </Text>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  navHeader: { paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  backBtn: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.sm },
  headerLabel: { ...typography.label, letterSpacing: 3, color: colors.textMuted },
  headerName: { ...typography.display, fontSize: 30 },

  summaryCard: { gap: spacing.md, marginBottom: spacing.sm },
  summaryTop: { flexDirection: 'row', alignItems: 'center' },
  summaryStat: { flex: 1, alignItems: 'center', gap: 2 },
  summaryValue: { fontSize: 28, fontWeight: '900', color: colors.textPrimary },
  summaryLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, color: colors.textMuted },
  summaryDivider: { width: 1, height: 32, backgroundColor: colors.border },
  summaryBarTrack: {
    flexDirection: 'row', height: 6, borderRadius: radius.full,
    overflow: 'hidden', gap: 2,
  },
  summaryBarSeg: { height: '100%', borderRadius: radius.full },
  volLine: { ...typography.caption, textAlign: 'center' },
  currentWeekNote: { ...typography.caption, fontSize: 10, textAlign: 'center', fontStyle: 'italic' },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    marginTop: spacing.md,
  },
  sectionLabel: { ...typography.label, letterSpacing: 2 },

  exRow: { gap: 0 },
  exRowHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  exRowInfo: { flex: 1 },
  exRowName: { ...typography.h3, fontSize: 15 },
  exRowMeta: { ...typography.caption, marginTop: 2 },
  deltaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: radius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  deltaText: { fontSize: 12, fontWeight: '900' },
  exRowChart: { marginTop: spacing.md, gap: spacing.xs },
  chartCaption: { ...typography.label, fontSize: 9, letterSpacing: 1.5 },

  noHistoryText: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
  noHistoryHint: { ...typography.caption, fontSize: 10, fontStyle: 'italic' },

  emptyCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyTitle: { ...typography.h3, color: colors.textMuted },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
