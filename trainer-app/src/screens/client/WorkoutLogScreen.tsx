import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Exercise, ExerciseSeries, WorkoutLog } from '../../types';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';
import ExerciseVideo from '../../components/common/ExerciseVideo';
import MuscleMap from '../../components/common/MuscleMap';
import { showAlert } from '../../lib/alert';
import { getCurrentWeek, formatShortDate } from '../../lib/weeks';

type RouteParams = { exercise: Exercise; week: number };

interface SeriesEntry {
  series: ExerciseSeries;
  // texto crudo mientras se edita: guardar números rompe la escritura de decimales ("7." → 7)
  weight: string;
  reps: string;
  rir: string;
  prev?: { weight: number; reps: number; week: number };
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
  const [showImage, setShowImage] = useState(true);
  const [timerLeft, setTimerLeft] = useState<number | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const restSeconds = exercise.rest_seconds ?? 90;

  function startRestTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerLeft(restSeconds);
    timerRef.current = setInterval(() => {
      setTimerLeft(prev => {
        if (prev == null || prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          return null;
        }
        if (prev === 4 && Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return prev - 1;
      });
    }, 1000);
  }

  function stopRestTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerLeft(null);
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

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

    if (seriesIds.length === 0) { setLoading(false); return; }

    // logs de esta semana + el registro previo más reciente por serie
    const { data: logsData } = await supabase
      .from('workout_logs')
      .select('*')
      .in('series_id', seriesIds)
      .lte('week_number', week)
      .order('week_number', { ascending: false });

    const currentMap: Record<string, WorkoutLog> = {};
    const prevMap: Record<string, WorkoutLog> = {};
    (logsData ?? []).forEach(l => {
      if (l.week_number === week && !currentMap[l.series_id]) currentMap[l.series_id] = l;
      else if (l.week_number < week && !prevMap[l.series_id]) prevMap[l.series_id] = l;
    });

    setEntries(seriesList.map(s => {
      const prev = prevMap[s.id];
      const cur = currentMap[s.id];
      return {
        series: s,
        weight: cur ? String(cur.weight) : (prev?.weight ?? exercise.ref_weight)?.toString() ?? '',
        reps: cur ? String(cur.reps) : '',
        rir: cur?.rir != null ? String(cur.rir) : '',
        prev: prev ? { weight: prev.weight, reps: prev.reps, week: prev.week_number } : undefined,
        saved: !!cur,
      };
    }));
    setLoading(false);
  }

  function updateEntry(index: number, field: 'weight' | 'reps' | 'rir', value: string) {
    // permitir solo dígitos y un separador decimal (punto o coma)
    const clean = value.replace(/[^0-9.,]/g, '').replace(/([.,].*)[.,]/, '$1');
    setEntries(prev => prev.map((e, i) => i === index
      ? { ...e, [field]: clean, saved: false }
      : e
    ));
  }

  const toNum = (s: string) => {
    const n = parseFloat(s.replace(',', '.'));
    return isNaN(n) ? null : n;
  };

  // autoprogresión: si completó el tope del rango en todas las series previas → sugerir +2.5%
  const repTop = (() => {
    const m = exercise.reps_objective?.match(/(\d+)\s*-\s*(\d+)/);
    if (m) return parseInt(m[2], 10);
    const single = parseInt(exercise.reps_objective ?? '', 10);
    return isNaN(single) ? null : single;
  })();
  const suggestion = React.useMemo(() => {
    if (!repTop || entries.length === 0) return null;
    if (entries.some(e => e.saved)) return null;               // ya registró hoy
    if (!entries.every(e => e.prev && e.prev.reps >= repTop)) return null;
    return entries.map(e => Math.round(e.prev!.weight * 1.025 * 2) / 2);
  }, [entries, repTop]);

  function applySuggestion() {
    if (!suggestion) return;
    setEntries(prev => prev.map((e, i) => ({ ...e, weight: String(suggestion[i]), saved: false })));
  }

  async function saveAll() {
    const toSave = entries
      .map(e => ({ ...e, weightNum: toNum(e.weight), repsNum: toNum(e.reps), rirNum: e.rir === '' ? null : Math.min(9, Math.round(toNum(e.rir) ?? 0)) }))
      .filter(e => e.weightNum != null && e.repsNum != null);
    if (toSave.length === 0) {
      showAlert('Nada que guardar', 'Ingresa peso y reps en al menos una serie.');
      return;
    }

    setSaving(true);
    const now = new Date().toISOString();
    let failed = 0;

    for (const entry of toSave) {
      const { data: existing } = await supabase
        .from('workout_logs')
        .select('id')
        .eq('series_id', entry.series.id)
        .eq('week_number', week)
        .maybeSingle();

      const { error } = existing
        ? await supabase.from('workout_logs').update({
            weight: entry.weightNum,
            reps: entry.repsNum,
            rir: entry.rirNum,
            logged_at: now,
          }).eq('id', existing.id)
        : await supabase.from('workout_logs').insert({
            series_id: entry.series.id,
            week_number: week,
            weight: entry.weightNum,
            reps: entry.repsNum,
            rir: entry.rirNum,
            logged_at: now,
            logged_by: user?.id,
          });
      if (error) failed++;
    }

    setSaving(false);
    if (failed > 0) {
      showAlert('Error al guardar', `${failed} serie(s) no se pudieron guardar. Intenta de nuevo.`);
    } else {
      showAlert('¡Guardado!', 'Tu entrenamiento fue registrado.', () => navigation.goBack());
    }
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
          <Ionicons name="arrow-back" size={16} color={colors.textMuted} />
          <Text style={styles.backText}>ATRÁS</Text>
        </TouchableOpacity>
        <Text style={styles.exerciseName}>{exercise.name.toUpperCase()}</Text>
        {exercise.name_en ? <Text style={styles.nameEn}>{exercise.name_en}</Text> : null}
        <Text style={styles.meta}>
          {week === getCurrentWeek()
            ? formatShortDate(new Date().toISOString()).toUpperCase()
            : `EDITANDO REGISTRO ANTERIOR`} · {exercise.reps_objective} REPS · {exercise.unit.toUpperCase()}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Ejemplo del ejercicio */}
        {(exercise.image_url || exercise.notes || exercise.video_url || exercise.muscle_group) && (
          <Card style={styles.exampleCard}>
            <TouchableOpacity style={styles.exampleHeader} onPress={() => setShowImage(v => !v)}>
              <Text style={styles.exampleTitle}>CÓMO SE HACE</Text>
              <Ionicons name={showImage ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
            </TouchableOpacity>
            {showImage && (
              <>
                {exercise.muscle_group && (
                  <View style={styles.muscleRow}>
                    <MuscleMap height={130} highlights={{ [exercise.muscle_group]: 1 }} showLabels={false} />
                    <Text style={styles.muscleTag}>{exercise.muscle_group.toUpperCase()}</Text>
                  </View>
                )}
                {exercise.image_url && (
                  <Image source={{ uri: exercise.image_url }} style={styles.exampleImage} resizeMode="cover" />
                )}
                {exercise.notes ? <Text style={styles.exampleNotes}>{exercise.notes}</Text> : null}
                {exercise.video_url ? <ExerciseVideo url={exercise.video_url} /> : null}
              </>
            )}
          </Card>
        )}

        {suggestion && (
          <TouchableOpacity style={styles.suggestionBanner} onPress={applySuggestion} activeOpacity={0.8}>
            <Ionicons name="trending-up" size={16} color={colors.background} />
            <Text style={styles.suggestionText}>
              Completaste el rango la semana pasada — toca para subir +2.5%
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 0.5 }]}>SERIE</Text>
          <Text style={[styles.th, { flex: 1 }]}>PESO ({exercise.unit})</Text>
          <Text style={[styles.th, { flex: 1 }]}>REPS</Text>
          <Text style={[styles.th, { flex: 0.6 }]}>RIR</Text>
        </View>

        {entries.map((entry, i) => (
          <View key={entry.series.id}>
            <View style={[styles.row, entry.saved && styles.rowSaved]}>
              <View style={[styles.seriesBadge, { flex: 0.5 }]}>
                <Text style={styles.seriesText}>S{entry.series.series_number}</Text>
                {entry.saved && <Ionicons name="checkmark-circle" size={14} color={colors.success} />}
              </View>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={entry.weight}
                onChangeText={v => updateEntry(i, 'weight', v)}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={entry.reps}
                onChangeText={v => updateEntry(i, 'reps', v)}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
              />
              <TextInput
                style={[styles.input, { flex: 0.6 }]}
                value={entry.rir}
                onChangeText={v => updateEntry(i, 'rir', v)}
                keyboardType="number-pad"
                placeholder="–"
                placeholderTextColor={colors.textMuted}
                maxLength={1}
              />
            </View>
            {entry.prev && (
              <Text style={styles.prevText}>
                Última vez (S{entry.prev.week}): {entry.prev.weight}{exercise.unit} × {entry.prev.reps}
              </Text>
            )}
          </View>
        ))}

        {timerLeft != null ? (
          <TouchableOpacity style={styles.timerActive} onPress={stopRestTimer} activeOpacity={0.8}>
            <Text style={styles.timerCount}>
              {Math.floor(timerLeft / 60)}:{String(timerLeft % 60).padStart(2, '0')}
            </Text>
            <Text style={styles.timerHint}>DESCANSANDO · TOCA PARA CANCELAR</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.timerBtn} onPress={startRestTimer} activeOpacity={0.8}>
            <Ionicons name="timer-outline" size={18} color={colors.accent} />
            <Text style={styles.timerBtnText}>
              INICIAR DESCANSO ({Math.floor(restSeconds / 60)}:{String(restSeconds % 60).padStart(2, '0')})
            </Text>
          </TouchableOpacity>
        )}

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
  backBtn: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
  exerciseName: { ...typography.display, fontSize: 28 },
  meta: { ...typography.label, color: colors.accent, letterSpacing: 2 },
  nameEn: { ...typography.caption, fontStyle: 'italic', marginTop: -2 },
  paramRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  paramChip: {
    fontSize: 9, fontWeight: '800', letterSpacing: 1, color: colors.textSecondary,
    backgroundColor: colors.surface, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  suggestionBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    marginBottom: spacing.xs,
  },
  suggestionText: { color: colors.background, fontSize: 12, fontWeight: '800', flex: 1 },
  timerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.accent + '55',
    paddingVertical: spacing.md, marginTop: spacing.xs,
  },
  timerBtnText: { ...typography.label, color: colors.accent, letterSpacing: 1.5 },
  timerActive: {
    alignItems: 'center', gap: 2,
    borderRadius: radius.md, backgroundColor: colors.accentSoft,
    borderWidth: 1, borderColor: colors.accent,
    paddingVertical: spacing.sm, marginTop: spacing.xs,
  },
  timerCount: { fontSize: 34, fontWeight: '900', color: colors.accent, fontVariant: ['tabular-nums'] },
  timerHint: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, color: colors.textMuted },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },

  exampleCard: { gap: spacing.sm, marginBottom: spacing.sm },
  exampleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  exampleTitle: { ...typography.label, color: colors.accent, letterSpacing: 2 },
  exampleImage: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  exampleNotes: { ...typography.body, color: colors.textPrimary, lineHeight: 21 },
  muscleRow: { alignItems: 'center', gap: spacing.xs },
  muscleTag: {
    ...typography.label, fontSize: 9, letterSpacing: 2, color: colors.accent,
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
    flexDirection: 'row',
    gap: 4,
  },
  seriesText: {
    fontWeight: '900',
    color: colors.accent,
    fontSize: 16,
  },
  prevText: {
    ...typography.caption,
    fontSize: 11,
    paddingHorizontal: spacing.sm,
    paddingTop: 4,
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
