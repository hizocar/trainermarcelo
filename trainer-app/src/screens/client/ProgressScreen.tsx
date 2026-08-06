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
import { colors, spacing, radius, typography, fonts } from '../../theme';
import Card from '../../components/common/Card';
import TrendChart from '../../components/common/TrendChart';
import { getCurrentWeek } from '../../lib/weeks';
import { energyPerformance } from '../../lib/progress';
import { resolveActiveWeek, PlanWeek } from '../../lib/plan';
import HistoryScreen from './HistoryScreen';

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
  day_id: string;
  library_id: string | null;
}

// Con "Gestión de semanas" cada semana duplicada crea FILAS de ejercicio
// nuevas (mismo ejercicio, id distinto) — sin esto, "Press banca" se vería
// como varios ejercicios sueltos de un solo punto cada vez que el coach
// duplica una semana, en vez de una sola línea de progreso continua.
const contKey = (e: ExerciseInfo) => e.library_id ?? e.name.trim().toLowerCase();

interface PlanDay {
  id: string;
  day_number: number;
  name: string;
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
  const [planDays, setPlanDays] = useState<PlanDay[]>([]);
  const [volDay, setVolDay] = useState<string | null>(null);
  const [exercises, setExercises] = useState<ExerciseInfo[]>([]);
  const [seriesExMap, setSeriesExMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'evolucion' | 'historial'>('evolucion');
  const [energyStats, setEnergyStats] = useState<ReturnType<typeof energyPerformance>>(null);

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
      .from('training_days').select('id, day_number, name, plan_week_id')
      .eq('plan_id', plan.id).order('day_number');
    const dayIds = (days ?? []).map(d => d.id);
    if (dayIds.length === 0) { setLoading(false); return; }

    // "días del plan" para agrupar/filtrar en pantalla = solo los de la
    // semana activa ahora mismo; el HISTORIAL (más abajo) sí mira todas las
    // semanas que alguna vez existieron, para no perder progreso pasado
    const { data: weeksData } = await supabase
      .from('plan_weeks').select('*').eq('plan_id', plan.id).eq('archived', false);
    const activeWeek = resolveActiveWeek((weeksData ?? []) as PlanWeek[], getCurrentWeek());
    const currentDays = activeWeek ? (days ?? []).filter(d => d.plan_week_id === activeWeek.id) : [];
    setPlanDays(currentDays);

    const { data: exs } = await supabase
      .from('exercises').select('id, name, unit, day_id, library_id')
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
      .select('series_id, week_number, weight, reps, logged_at')
      .in('series_id', Object.keys(sMap));
    setLogs(logsData ?? []);

    // cruce energía × rendimiento: volumen por fecha vs energía reportada
    const { data: moodData } = await supabase
      .from('mood_logs').select('logged_date, mood').eq('user_id', targetId);
    const volByDate: Record<string, number> = {};
    (logsData ?? []).forEach((l: any) => {
      if (!l.logged_at) return;
      const d = l.logged_at.slice(0, 10);
      volByDate[d] = (volByDate[d] ?? 0) + l.weight * l.reps;
    });
    const sessions = Object.entries(volByDate).map(([date, volume]) => ({ date, volume }));
    const moods = (moodData ?? [])
      .map((m: any) => ({ logged_date: m.logged_date, energy: parseInt(m.mood, 10) }))
      .filter((m: any) => !isNaN(m.energy));
    setEnergyStats(energyPerformance(sessions, moods));

    setLoading(false);
  }

  // Semanas parciales fuera de los cálculos: distorsionan. Una semana está
  // en curso si es la semana calendario actual, o si es la última con datos
  // y aún no registra todos los días del plan.
  const currentWeek = getCurrentWeek();
  const { closedLogs, partialWeek } = useMemo(() => {
    const valid = logs.filter(l => l.week_number < currentWeek);
    if (valid.length === 0) return { closedLogs: valid, partialWeek: logs.length > 0 ? currentWeek : null };

    const exDay: Record<string, string> = {};
    exercises.forEach(e => { exDay[e.id] = e.day_id; });
    const daysInWeek: Record<number, Set<string>> = {};
    valid.forEach(l => {
      const d = exDay[seriesExMap[l.series_id]];
      if (d) (daysInWeek[l.week_number] ??= new Set()).add(d);
    });
    const lastWeek = Math.max(...valid.map(l => l.week_number));
    const isPartial = (daysInWeek[lastWeek]?.size ?? 0) < planDays.length;
    return {
      closedLogs: isPartial ? valid.filter(l => l.week_number !== lastWeek) : valid,
      partialWeek: isPartial ? lastWeek : (logs.length > valid.length ? currentWeek : null),
    };
  }, [logs, currentWeek, exercises, seriesExMap, planDays]);
  const hasCurrentWeekLogs = partialWeek != null;

  // ── progresión por ejercicio ──────────────────────────────────────────────
  const progress = useMemo<ExProgress[]>(() => {
    const exById: Record<string, ExerciseInfo> = {};
    exercises.forEach(e => { exById[e.id] = e; });
    const currentDayIds = new Set(planDays.map(d => d.id));

    // agrupado por CONTINUIDAD (misma biblioteca o mismo nombre), no por id
    // de fila — así una semana duplicada no fragmenta el progreso
    const byKey: Record<string, Record<number, LogRow[]>> = {};
    const repByKey: Record<string, ExerciseInfo> = {};
    closedLogs.forEach(l => {
      const exId = seriesExMap[l.series_id];
      const ex = exId ? exById[exId] : undefined;
      if (!ex) return;
      const key = contKey(ex);
      ((byKey[key] ??= {})[l.week_number] ??= []).push(l);
      // preferimos como "representante" (nombre/unidad/día a mostrar) el que
      // pertenece a la semana activa ahora mismo
      if (!repByKey[key] || currentDayIds.has(ex.day_id)) repByKey[key] = ex;
    });

    return Object.keys(byKey).map(key => {
      const weeks = Object.keys(byKey[key]).map(Number).sort((a, b) => a - b);
      const points = weeks.map(w => ({
        week: w,
        score: Math.max(...byKey[key][w].map(l => score(l.weight, l.reps))),
      }));
      const last = points[points.length - 1];
      const prev = points.length > 1 ? points[points.length - 2] : null;
      const delta = prev ? ((last.score - prev.score) / prev.score) * 100 : null;

      let best = { weight: 0, reps: 0, week: 0 };
      weeks.forEach(w => byKey[key][w].forEach(l => {
        if (score(l.weight, l.reps) > score(best.weight, best.reps)) {
          best = { weight: l.weight, reps: l.reps, week: w };
        }
      }));

      return { exercise: repByKey[key], points, delta, lastWeek: last.week, best };
    });
  }, [closedLogs, exercises, seriesExMap, planDays]);

  // agrupado por día del plan (Torso 1, Pierna, ...) en el orden del plan
  const toneOf = (d: number | null): 'up' | 'flat' | 'down' =>
    d == null ? 'flat' : d > 1 ? 'up' : d < -1 ? 'down' : 'flat';
  const byDay = useMemo(() => {
    return planDays
      .map(day => ({ day, rows: progress.filter(p => p.exercise.day_id === day.id) }))
      .filter(g => g.rows.length > 0);
  }, [planDays, progress]);

  const improving = progress.filter(p => p.delta != null && p.delta > 1)
    .sort((a, b) => b.delta! - a.delta!);
  const steady = progress.filter(p => p.delta != null && p.delta >= -1 && p.delta <= 1);
  const declining = progress.filter(p => p.delta != null && p.delta < -1)
    .sort((a, b) => a.delta! - b.delta!);
  const noHistory = progress.filter(p => p.delta == null);

  // ── volumen semanal, filtrable por día del plan ───────────────────────────
  const weeklyVolume = useMemo(() => {
    const exDay: Record<string, string> = {};
    exercises.forEach(e => { exDay[e.id] = e.day_id; });
    const byWeek: Record<number, number> = {};
    closedLogs.forEach(l => {
      if (volDay && exDay[seriesExMap[l.series_id]] !== volDay) return;
      byWeek[l.week_number] = (byWeek[l.week_number] ?? 0) + l.weight * l.reps;
    });
    return Object.entries(byWeek)
      .map(([w, v]) => ({ week: Number(w), volume: Math.round(v) }))
      .sort((a, b) => a.week - b.week);
  }, [closedLogs, volDay, exercises, seriesExMap]);

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
    const toneColor = tone === 'up' ? colors.success : tone === 'down' ? colors.danger : colors.textMuted;
    return (
      <Card key={p.exercise.id} style={styles.exRow}>
        <View style={styles.exRowHeader}>
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
        </View>
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

      <View style={styles.headerBlock}>
        <Text style={styles.headerLabel}>PROGRESO</Text>
        <Text style={styles.headerName}>{targetName.toUpperCase()}</Text>
        {!isCoachView && (
          <View style={styles.segment}>
            {([['evolucion', 'EVOLUCIÓN'], ['historial', 'HISTORIAL']] as const).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[styles.segmentBtn, tab === key && styles.segmentBtnActive]}
                onPress={() => setTab(key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentText, tab === key && styles.segmentTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {tab === 'historial' && !isCoachView ? (
        <HistoryScreen embedded />
      ) : (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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
                  Volumen{volDay ? ` DÍA ${planDays.find(d => d.id === volDay)?.day_number}` : ''} S{weeklyVolume[weeklyVolume.length - 1].week}:{' '}
                  <Text style={{ color: volDelta >= 0 ? colors.success : colors.danger, fontWeight: '800' }}>
                    {fmtDelta(volDelta)}
                  </Text>{' '}
                  vs S{weeklyVolume[weeklyVolume.length - 2].week}
                </Text>
              )}

              {/* filtro por día del plan */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.volDayChips}>
                <TouchableOpacity
                  style={[styles.volDayChip, volDay == null && styles.volDayChipActive]}
                  onPress={() => setVolDay(null)}
                >
                  <Text style={[styles.volDayChipText, volDay == null && styles.volDayChipTextActive]}>TODO</Text>
                </TouchableOpacity>
                {planDays.map(d => (
                  <TouchableOpacity
                    key={d.id}
                    style={[styles.volDayChip, volDay === d.id && styles.volDayChipActive]}
                    onPress={() => setVolDay(volDay === d.id ? null : d.id)}
                  >
                    <Text style={[styles.volDayChipText, volDay === d.id && styles.volDayChipTextActive]}>
                      DÍA {d.day_number} · {d.name.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {weeklyVolume.length >= 2 ? (
                <TrendChart
                  data={weeklyVolume.map(w => ({ label: `S${w.week}`, value: w.volume }))}
                  height={120}
                />
              ) : (
                <Text style={styles.currentWeekNote}>Este día aún no tiene dos semanas completas para comparar.</Text>
              )}

              {hasCurrentWeekLogs && (
                <Text style={styles.currentWeekNote}>
                  ⏳ La semana {partialWeek} está en curso: se sumará al gráfico cuando estén todos sus días registrados
                </Text>
              )}
            </Card>

            {energyStats && (
              <Card highlight style={styles.energyCard}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="flash" size={14} color={colors.accent} />
                  <Text style={[styles.sectionLabel, { color: colors.accent }]}>ENERGÍA Y RENDIMIENTO</Text>
                </View>
                <Text style={styles.energyHeadline}>
                  {energyStats.deltaPct > 0
                    ? `Rindes ${energyStats.deltaPct}% más los días que llegas con energía`
                    : energyStats.deltaPct < 0
                      ? `Curiosamente rindes ${Math.abs(energyStats.deltaPct)}% más los días de baja energía`
                      : 'Tu rendimiento es parejo con cualquier nivel de energía'}
                </Text>
                <View style={styles.energyCompare}>
                  <View style={styles.energyCol}>
                    <Text style={[styles.energyVal, { color: colors.danger }]}>
                      {energyStats.low.toLocaleString()}
                    </Text>
                    <Text style={styles.energyColLabel}>ENERGÍA BAJA (1-4)</Text>
                    <Text style={styles.energyDays}>{energyStats.lowDays} día{energyStats.lowDays > 1 ? 's' : ''}</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.energyCol}>
                    <Text style={[styles.energyVal, { color: colors.accent }]}>
                      {energyStats.high.toLocaleString()}
                    </Text>
                    <Text style={styles.energyColLabel}>ENERGÍA ALTA (7-10)</Text>
                    <Text style={styles.energyDays}>{energyStats.highDays} día{energyStats.highDays > 1 ? 's' : ''}</Text>
                  </View>
                </View>
                <Text style={styles.energyFoot}>Volumen medio por sesión (kg levantados)</Text>
              </Card>
            )}

            {byDay.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Ionicons name="calendar-outline" size={14} color={colors.accent} />
                  <Text style={[styles.sectionLabel, { color: colors.accent }]}>PROGRESO POR DÍA</Text>
                </View>
                {byDay.map(({ day, rows }) => (
                  <View key={day.id} style={styles.dayGroup}>
                    <Text style={styles.dayGroupTitle}>DÍA {day.day_number} · {day.name.toUpperCase()}</Text>
                    {rows.map(p => renderRow(p, toneOf(p.delta)))}
                  </View>
                ))}
              </>
            )}

            <View style={styles.rankingDivider} />
            <Text style={styles.rankingHint}>Ranking global · de mayor a menor cambio</Text>

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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  navHeader: { paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  backBtn: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.sm },
  headerBlock: { paddingHorizontal: spacing.xl, gap: spacing.sm, marginBottom: spacing.sm },
  segment: {
    flexDirection: 'row', gap: 4,
    backgroundColor: colors.surface, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border, padding: 3,
  },
  segmentBtn: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.full },
  segmentBtnActive: { backgroundColor: colors.accent },
  segmentText: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: colors.textMuted },
  segmentTextActive: { color: colors.background },
  headerLabel: { ...typography.label, letterSpacing: 3, color: colors.textMuted },
  headerName: { ...typography.display, fontSize: 30 },

  summaryCard: { gap: spacing.md, marginBottom: spacing.sm },
  summaryTop: { flexDirection: 'row', alignItems: 'center' },
  summaryStat: { flex: 1, alignItems: 'center', gap: 2 },
  summaryValue: { fontFamily: fonts.mono, fontSize: 26, color: colors.textPrimary },
  summaryLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, color: colors.textMuted },
  summaryDivider: { width: 1, height: 32, backgroundColor: colors.border },
  summaryBarTrack: {
    flexDirection: 'row', height: 6, borderRadius: radius.full,
    overflow: 'hidden', gap: 2,
  },
  summaryBarSeg: { height: '100%', borderRadius: radius.full },
  volLine: { ...typography.caption, textAlign: 'center' },
  currentWeekNote: { ...typography.caption, fontSize: 10, textAlign: 'center', fontStyle: 'italic' },
  volDayChips: { gap: spacing.xs + 2 },
  volDayChip: {
    paddingHorizontal: spacing.sm + 2, paddingVertical: 4,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  volDayChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  volDayChipText: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: colors.textMuted },
  volDayChipTextActive: { color: colors.background },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    marginTop: spacing.md,
  },
  sectionLabel: { ...typography.label, letterSpacing: 2 },
  dayGroup: { gap: spacing.sm, marginTop: spacing.xs },
  dayGroupTitle: { ...typography.label, fontSize: 11, letterSpacing: 1.5, color: colors.textSecondary },
  rankingDivider: { height: 1, backgroundColor: colors.border, marginTop: spacing.lg },
  rankingHint: { ...typography.caption, fontSize: 10, fontStyle: 'italic', marginTop: spacing.xs },
  energyCard: { gap: spacing.sm, marginTop: spacing.sm },
  energyHeadline: { ...typography.h3, fontSize: 15, lineHeight: 21 },
  energyCompare: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  energyCol: { flex: 1, alignItems: 'center', gap: 2 },
  energyVal: { fontFamily: fonts.mono, fontSize: 20 },
  energyColLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: colors.textMuted },
  energyDays: { fontSize: 9, color: colors.textMuted },
  energyFoot: { ...typography.caption, fontSize: 10, textAlign: 'center', fontStyle: 'italic' },

  exRow: { gap: 0 },
  exRowHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  exRowInfo: { flex: 1 },
  exRowName: { ...typography.h3, fontSize: 15 },
  exRowMeta: { ...typography.monoSm, fontSize: 11, marginTop: 2 },
  deltaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: radius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  deltaText: { ...typography.mono, fontSize: 12, fontWeight: undefined },

  noHistoryText: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
  noHistoryHint: { ...typography.caption, fontSize: 10, fontStyle: 'italic' },

  emptyCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyTitle: { ...typography.h3, color: colors.textMuted },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
