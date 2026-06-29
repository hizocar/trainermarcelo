import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Exercise, ExerciseSeries, WorkoutLog } from '../../types';
import { colors, spacing, radius, typography } from '../../theme';

type RouteParams = { exercise: Exercise; week: number };

interface SeriesEntry {
  series: ExerciseSeries;
  log: Partial<WorkoutLog>;
  saved: boolean;
}

export default function WorkoutLogScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { exercise, week } = route.params as RouteParams;
  const { user } = useAuth();

  const [entries, setEntries] = useState<SeriesEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSeriesAndLogs();
  }, []);

  async function fetchSeriesAndLogs() {
    const { data: seriesData } = await supabase
      .from('exercise_series')
      .select('*')
      .eq('exercise_id', exercise.id)
      .order('series_number');

    const seriesList: ExerciseSeries[] = seriesData ?? [];
    const seriesIds = seriesList.map(s => s.id);

    const { data: logsData } = await supabase
      .from('workout_logs')
      .select('*')
      .in('series_id', seriesIds)
      .eq('week_number', week);

    const logMap: Record<string, WorkoutLog> = {};
    (logsData ?? []).forEach(l => { logMap[l.series_id] = l; });

    setEntries(seriesList.map(s => ({
      series: s,
      log: logMap[s.id]
        ? { weight: logMap[s.id].weight, reps: logMap[s.id].reps }
        : { weight: exercise.ref_weight, reps: undefined },
      saved: !!logMap[s.id],
    })));
    setLoading(false);
  }

  function updateEntry(index: number, field: 'weight' | 'reps', value: string) {
    setEntries(prev => prev.map((e, i) => i === index
      ? { ...e, log: { ...e.log, [field]: value === '' ? undefined : parseFloat(value) }, saved: false }
      : e
    ));
  }

  async function saveAll() {
    setSaving(true);
    const now = new Date().toISOString();

    for (const entry of entries) {
      if (entry.log.weight == null || entry.log.reps == null) continue;

      const { data: existing } = await supabase
        .from('workout_logs')
        .select('id')
        .eq('series_id', entry.series.id)
        .eq('week_number', week)
        .single();

      if (existing) {
        await supabase.from('workout_logs').update({
          weight: entry.log.weight,
          reps: entry.log.reps,
          logged_at: now,
        }).eq('id', existing.id);
      } else {
        await supabase.from('workout_logs').insert({
          series_id: entry.series.id,
          week_number: week,
          weight: entry.log.weight,
          reps: entry.log.reps,
          logged_at: now,
          logged_by: user?.id,
        });
      }
    }

    setSaving(false);
    Alert.alert('¡Guardado!', 'Tu entrenamiento fue registrado.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  }

  if (loading) return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.accent} style={{ marginTop: 100 }} />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← ATRÁS</Text>
        </TouchableOpacity>
        <Text style={styles.exerciseName}>{exercise.name.toUpperCase()}</Text>
        <Text style={styles.meta}>SEMANA {week} · {exercise.reps_objective} REPS · {exercise.unit}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 0.5 }]}>SERIE</Text>
          <Text style={[styles.th, { flex: 1 }]}>PESO ({exercise.unit})</Text>
          <Text style={[styles.th, { flex: 1 }]}>REPS</Text>
        </View>

        {entries.map((entry, i) => (
          <View key={entry.series.id} style={[styles.row, entry.saved && styles.rowSaved]}>
            <View style={[styles.seriesBadge, { flex: 0.5 }]}>
              <Text style={styles.seriesText}>S{entry.series.series_number}</Text>
            </View>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={entry.log.weight?.toString() ?? ''}
              onChangeText={v => updateEntry(i, 'weight', v)}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={entry.log.reps?.toString() ?? ''}
              onChangeText={v => updateEntry(i, 'reps', v)}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        ))}

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={saveAll}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator color={colors.background} />
            : <Text style={styles.saveBtnText}>GUARDAR ENTRENAMIENTO</Text>
          }
        </TouchableOpacity>
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
  header: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  backBtn: { alignSelf: 'flex-start' },
  backText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
  exerciseName: { fontSize: 28, fontWeight: '900', color: colors.textPrimary, letterSpacing: -1 },
  meta: { ...typography.label, color: colors.accent, letterSpacing: 2 },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  tableHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  th: {
    ...typography.label,
    letterSpacing: 1,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowSaved: {
    borderColor: colors.accent,
  },
  seriesBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  seriesText: {
    fontWeight: '900',
    color: colors.accent,
    fontSize: 16,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    color: colors.background,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 2,
  },
});
