import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { User } from '../../types';
import { fetchFullPlan, fetchLogs, activeDays, PlanDay } from '../../lib/plan';
import { getCurrentWeek, WEEK_DAYS_SHORT, formatShortDate } from '../../lib/weeks';
import { fetchCardioLogs, CardioLog } from '../../lib/cardio';
import { colors, spacing, radius, typography, fonts } from '../../theme';
import Card from '../../components/common/Card';

// Vista semanal del coach: qué hizo REALMENTE el alumno cada día de una
// semana — peso y reps serie por serie, no solo si completó o no. Se puede
// navegar hacia atrás y adelante entre semanas igual que el alumno.

type RouteParams = { client: User };

interface SetLog { series_number: number; weight: number; reps: number; rir?: number | null }

export default function ClientWeekScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { client } = route.params as RouteParams;

  const currentWeek = getCurrentWeek();
  const [week, setWeek] = useState(currentWeek);
  const [days, setDays] = useState<PlanDay[]>([]);
  const [noPlan, setNoPlan] = useState(false);
  // exercise_id -> sets registrados esa semana
  const [setsByEx, setSetsByEx] = useState<Record<string, SetLog[]>>({});
  const [dateByDay, setDateByDay] = useState<Record<string, string>>({});
  const [cardio, setCardio] = useState<CardioLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(week); }, [week]);

  async function load(w: number) {
    setLoading(true);
    const plan = await fetchFullPlan(client.id, w);
    if (!plan) { setDays([]); setNoPlan(true); setLoading(false); return; }
    setNoPlan(!plan.activeWeek);

    const list = activeDays(plan.days);
    setDays(list);

    const logs = await fetchLogs(plan.seriesIds, w);

    // series_id -> series_number (para mostrar S1, S2… en orden)
    const seriesNum: Record<string, number> = {};
    list.forEach(d => d.exercises.forEach(e =>
      e.exercise_series.forEach(s => { seriesNum[s.id] = s.series_number; })));

    const byEx: Record<string, SetLog[]> = {};
    const dayDate: Record<string, string> = {};
    logs.forEach((l: any) => {
      const exId = plan.seriesToExercise[l.series_id];
      const dayId = plan.seriesToDay[l.series_id];
      if (!exId) return;
      (byEx[exId] ??= []).push({
        series_number: seriesNum[l.series_id] ?? 0,
        weight: l.weight, reps: l.reps, rir: l.rir,
      });
      // fecha real en que entrenó ese día (la más temprana registrada)
      if (dayId && l.logged_at && (!dayDate[dayId] || l.logged_at < dayDate[dayId])) {
        dayDate[dayId] = l.logged_at;
      }
    });
    Object.values(byEx).forEach(sets => sets.sort((a, b) => a.series_number - b.series_number));
    setSetsByEx(byEx);
    setDateByDay(dayDate);

    // cardio de esa semana calendario
    const all = await fetchCardioLogs(client.id, 400);
    const weekStart = new Date(Date.now() - (currentWeek - w) * 7 * 86400000);
    const startOfWeek = new Date(weekStart);
    startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek.getTime() + 7 * 86400000);
    setCardio(all.filter(c => {
      const t = new Date(c.logged_at).getTime();
      return t >= startOfWeek.getTime() && t < endOfWeek.getTime();
    }));

    setLoading(false);
  }

  const totalVolume = Object.values(setsByEx)
    .flat()
    .reduce((a, s) => a + s.weight * s.reps, 0);
  const doneExercises = Object.keys(setsByEx).length;
  const totalExercises = days.reduce((a, d) => a + d.exercises.length, 0);
  // solo la semana en curso admite registrar series; cualquier otra semana es de solo lectura
  const registrable = week === currentWeek;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={16} color={colors.textMuted} />
          <Text style={styles.backText}>ATRÁS</Text>
        </TouchableOpacity>
        <Text style={styles.headerLabel}>PROGRESO SEMANAL</Text>
        <Text style={styles.headerName}>{client.name.toUpperCase()}</Text>
      </View>

      <View style={styles.weekNav}>
        <TouchableOpacity
          style={styles.weekNavBtn}
          onPress={() => setWeek(w => Math.max(1, w - 1))}
          disabled={week <= 1}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={16} color={week <= 1 ? colors.textMuted : colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.weekNavLabel}>
          SEMANA {week}{week === currentWeek ? ' · ACTUAL' : week < currentWeek ? ' · PASADA' : ' · FUTURA'}
        </Text>
        <TouchableOpacity
          style={styles.weekNavBtn}
          onPress={() => setWeek(w => w + 1)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-forward" size={16} color={colors.textPrimary} />
        </TouchableOpacity>
        {week !== currentWeek && (
          <TouchableOpacity style={styles.todayBtn} onPress={() => setWeek(currentWeek)}>
            <Text style={styles.todayBtnText}>HOY</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {noPlan || days.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>SIN PLAN ESTA SEMANA</Text>
              <Text style={styles.emptyText}>
                No hay una semana planificada para la semana {week}. Créala desde “Editar plan · Semanas”.
              </Text>
            </Card>
          ) : (
            <>
              {registrable && (
                <Text style={styles.hint}>TOCA UN EJERCICIO PARA REGISTRAR SUS SERIES</Text>
              )}
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{doneExercises}/{totalExercises}</Text>
                  <Text style={styles.statLabel}>EJERCICIOS</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{Math.round(totalVolume).toLocaleString('es-CL')}</Text>
                  <Text style={styles.statLabel}>KG TOTALES</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{cardio.reduce((a, c) => a + c.duration_minutes, 0)}</Text>
                  <Text style={styles.statLabel}>MIN CARDIO</Text>
                </View>
              </View>

              {days.map(day => {
                const doneInDay = day.exercises.filter(e => setsByEx[e.id]).length;
                const trained = doneInDay > 0;
                return (
                  <Card key={day.id} style={styles.dayCard}>
                    <View style={styles.dayHead}>
                      <View style={[styles.dayBadge, trained && styles.dayBadgeDone]}>
                        <Text style={[styles.dayBadgeText, trained && styles.dayBadgeTextDone]}>
                          {day.week_day != null ? WEEK_DAYS_SHORT[day.week_day].toUpperCase() : `D${day.day_number}`}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.dayName}>{day.name.toUpperCase()}</Text>
                        <Text style={styles.dayMeta}>
                          {trained
                            ? `${doneInDay}/${day.exercises.length} ejercicios${dateByDay[day.id] ? ` · ${formatShortDate(dateByDay[day.id])}` : ''}`
                            : 'Sin registrar'}
                        </Text>
                      </View>
                      {trained && <Ionicons name="checkmark-circle" size={18} color={colors.success} />}
                    </View>

                    {day.exercises.map(ex => {
                      const sets = setsByEx[ex.id];
                      const filaEjercicio = (
                        <View style={styles.exBlock}>
                          <Text style={[styles.exName, !sets && styles.exNamePending]} numberOfLines={1}>
                            {ex.name}
                          </Text>
                          {sets ? (
                            <View style={styles.setRow}>
                              {sets.map((s, i) => (
                                <View key={i} style={styles.setPill}>
                                  <Text style={styles.setPillLabel}>S{s.series_number}</Text>
                                  <Text style={styles.setPillValue}>
                                    {s.weight}{ex.unit} × {s.reps}
                                    {s.rir != null ? ` · RIR ${s.rir}` : ''}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          ) : (
                            <Text style={styles.exPendingText}>
                              — sin registro ({ex.exercise_series.length} series planificadas)
                            </Text>
                          )}
                        </View>
                      );
                      return (
                        <View key={ex.id}>
                          {registrable ? (
                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={() => navigation.navigate('WorkoutLog', {
                                exercise: ex,
                                week,
                                athleteId: client.id,
                              })}
                            >
                              {filaEjercicio}
                            </TouchableOpacity>
                          ) : filaEjercicio}
                        </View>
                      );
                    })}
                    {day.exercises.length === 0 && (
                      <Text style={styles.exPendingText}>Sin ejercicios en este día.</Text>
                    )}
                  </Card>
                );
              })}

              {cardio.length > 0 && (
                <Card style={styles.dayCard}>
                  <Text style={styles.dayName}>CARDIO DE LA SEMANA</Text>
                  {cardio.map(c => (
                    <View key={c.id} style={styles.cardioRow}>
                      <Ionicons name="walk-outline" size={14} color={colors.accent} />
                      <Text style={styles.cardioText}>{c.type}</Text>
                      <Text style={styles.cardioDate}>{formatShortDate(c.logged_at)}</Text>
                      <Text style={styles.cardioMin}>{c.duration_minutes} min</Text>
                    </View>
                  ))}
                </Card>
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
  header: { paddingHorizontal: spacing.xl, marginBottom: spacing.sm, gap: 2 },
  backBtn: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.xs },
  backText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
  headerLabel: { ...typography.caption, letterSpacing: 3, color: colors.accent },
  headerName: { ...typography.displaySm },
  weekNav: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.xl, marginBottom: spacing.md,
  },
  weekNavBtn: {
    width: 30, height: 30, borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  weekNavLabel: { ...typography.label, letterSpacing: 1.5, fontSize: 11 },
  todayBtn: {
    marginLeft: 'auto', borderWidth: 1, borderColor: colors.accent, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  todayBtnText: { fontSize: 9, fontWeight: '900', letterSpacing: 1, color: colors.accent },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.sm },
  hint: { ...typography.label, color: colors.textMuted, marginBottom: spacing.sm },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  statBox: {
    flex: 1, alignItems: 'center', gap: 2,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md,
  },
  statValue: { ...typography.display, fontSize: 20, color: colors.accent },
  statLabel: { fontSize: 8.5, fontWeight: '800', letterSpacing: 1, color: colors.textMuted },
  emptyCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyTitle: { ...typography.h3, color: colors.textMuted },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  dayCard: { gap: spacing.sm },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayBadge: {
    backgroundColor: colors.surface, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  dayBadgeDone: { backgroundColor: colors.success, borderColor: colors.success },
  dayBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 1, color: colors.textMuted },
  dayBadgeTextDone: { color: colors.background },
  dayName: { ...typography.h3, fontSize: 15 },
  dayMeta: { ...typography.caption, fontSize: 10, marginTop: 1 },
  exBlock: { gap: 4, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  exName: { ...typography.body, fontSize: 13, fontWeight: '700' },
  exNamePending: { color: colors.textMuted, fontWeight: '400' },
  exPendingText: { ...typography.caption, fontSize: 10, fontStyle: 'italic' },
  setRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  setPill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.surface, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.border,
  },
  setPillLabel: { fontSize: 9, fontWeight: '900', color: colors.accent },
  setPillValue: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.textPrimary },
  cardioRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  cardioText: { ...typography.body, fontSize: 13, flex: 1 },
  cardioDate: { ...typography.caption, fontSize: 10 },
  cardioMin: { fontFamily: fonts.mono, fontSize: 12, color: colors.accent },
});
