import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Modal } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { Exercise } from '../../types';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';
import { dateForWeekDay, WEEK_DAYS_SHORT } from '../../lib/weeks';
import { showAlert } from '../../lib/alert';

interface SessionData {
  dayNumber: number;
  dayName: string;
  week: number;
  date: string;
  exercises: { exercise: Exercise; sets: { seriesNum: number; weight: number; reps: number }[] }[];
}

type RouteParams = { sessions: SessionData[]; dateLabel: string };

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Lun..Dom

export default function SessionDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { sessions, dateLabel } = route.params as RouteParams;
  const [fixingIndex, setFixingIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const primary = sessions[0];

  // Mueve TODOS los ejercicios registrados en esta sesión a otra fecha de
  // una sola vez — evita tener que corregir uno por uno.
  async function fixSessionDate(session: SessionData, newDate: Date) {
    setSaving(true);
    const exerciseIds = session.exercises.map(e => e.exercise.id);
    const { data: seriesRows, error: seriesErr } = await supabase
      .from('exercise_series').select('id').in('exercise_id', exerciseIds);
    if (seriesErr || !seriesRows) {
      setSaving(false);
      showAlert('No se pudo corregir', seriesErr?.message ?? 'Intenta de nuevo.');
      return;
    }
    // Sin `.eq('logged_by', ...)`: desde la v21 esa columna dice quién tecleó
    // el registro, así que filtrarla dejaba al alumno sin poder corregir la
    // fecha de una sesión que anotó su coach. RLS impide tocar registros de
    // otro plan. El `.in('series_id', ...)` se queda: es la lista corta de
    // las series de ESTA sesión, no una que crezca con el plan entero.
    //
    // `count: 'exact'` para no mentir: un update de cero filas no devuelve
    // error, y la pantalla decía "Fecha corregida" igual.
    const { error, count } = await supabase
      .from('workout_logs')
      .update({ logged_at: newDate.toISOString() }, { count: 'exact' })
      .eq('week_number', session.week)
      .in('series_id', seriesRows.map(s => s.id));
    setSaving(false);
    setFixingIndex(null);
    if (error) { showAlert('No se pudo corregir', error.message); return; }
    if (!count) {
      showAlert('No se pudo corregir', 'No se encontraron registros de esta sesión para mover.');
      return;
    }
    showAlert('Fecha corregida', 'Toda la sesión quedó registrada en el día correcto.', () => navigation.goBack());
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={16} color={colors.textMuted} />
          <Text style={styles.backText}>CALENDARIO</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <View style={styles.headerInfo}>
            <Text style={styles.dateLabel}>{dateLabel.toUpperCase()}</Text>
            <Text style={styles.title} numberOfLines={2}>
              {primary ? primary.dayName.toUpperCase() : ''}
            </Text>
          </View>
          {primary && (
            <View style={styles.dayBadge}>
              <Text style={styles.dayBadgeText}>D{primary.dayNumber}</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {sessions.map((session, si) => (
          <View key={si} style={styles.sessionBlock}>
            <View style={styles.sessionHead}>
              {sessions.length > 1 && (
                <Text style={styles.sessionTag}>DÍA {session.dayNumber} · {session.dayName.toUpperCase()} · S{session.week}</Text>
              )}
              <TouchableOpacity
                style={styles.fixBtn}
                onPress={() => setFixingIndex(si)}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={13} color={colors.accent} />
                <Text style={styles.fixBtnText}>CORREGIR FECHA DE LA SESIÓN</Text>
              </TouchableOpacity>
            </View>
            {session.exercises.map(({ exercise, sets }) => (
              <TouchableOpacity
                key={exercise.id}
                onPress={() => navigation.navigate('WorkoutLog', { exercise, week: session.week, date: session.date })}
                activeOpacity={0.7}
              >
                <Card style={styles.exCard}>
                  <View style={styles.exRow}>
                    {exercise.image_url ? (
                      <Image source={{ uri: exercise.image_url }} style={styles.thumb} />
                    ) : (
                      <View style={[styles.thumb, styles.thumbPlaceholder]}>
                        <Ionicons name="barbell-outline" size={22} color={colors.textMuted} />
                      </View>
                    )}
                    <View style={styles.exInfo}>
                      <Text style={styles.exName}>{exercise.name}</Text>
                      <Text style={styles.exMeta}>
                        {exercise.muscle_group ? `${exercise.muscle_group} · ` : ''}
                        {sets.length} series
                        {exercise.reps_objective ? ` · ${exercise.reps_objective} reps` : ''}
                      </Text>
                    </View>
                    <View style={styles.check}>
                      <Ionicons name="checkmark" size={20} color={colors.background} />
                    </View>
                  </View>
                  <View style={styles.setsRow}>
                    {sets.map(s => (
                      <View key={s.seriesNum} style={styles.setPill}>
                        <Text style={styles.setPillLabel}>S{s.seriesNum}</Text>
                        <Text style={styles.setPillValue}>{s.weight}{exercise.unit} × {s.reps}</Text>
                      </View>
                    ))}
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        ))}
        <Text style={styles.hint}>Toca un ejercicio para revisar o corregir lo registrado.</Text>
      </ScrollView>

      {/* Modal: elegir el día correcto de esa semana para toda la sesión */}
      <Modal
        visible={fixingIndex !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setFixingIndex(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setFixingIndex(null)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>¿Cuándo la hiciste en realidad?</Text>
            <Text style={styles.modalSub}>
              Se corrige la fecha de los {fixingIndex != null ? sessions[fixingIndex].exercises.length : 0} ejercicios de esta sesión de una vez.
            </Text>
            <View style={styles.chipsRow}>
              {fixingIndex != null && WEEKDAY_ORDER.map(wd => {
                const session = sessions[fixingIndex];
                const d = dateForWeekDay(session.week, wd);
                const isFuture = d.getTime() > Date.now();
                const isCurrent = new Date(session.date).toDateString() === d.toDateString();
                return (
                  <TouchableOpacity
                    key={wd}
                    style={[styles.chip, isCurrent && styles.chipActive, isFuture && styles.chipDisabled]}
                    onPress={() => !isFuture && !saving && fixSessionDate(session, d)}
                    disabled={isFuture || saving}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipDay, isCurrent && styles.chipDayActive]}>{WEEK_DAYS_SHORT[wd]}</Text>
                    <Text style={[styles.chipNum, isCurrent && styles.chipNumActive]}>{d.getDate()}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setFixingIndex(null)} disabled={saving}>
              <Text style={styles.modalCancelText}>{saving ? 'GUARDANDO…' : 'CANCELAR'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  header: { paddingHorizontal: spacing.xl, marginBottom: spacing.lg, gap: spacing.sm },
  backBtn: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerInfo: { flex: 1 },
  dateLabel: { ...typography.label, letterSpacing: 2, color: colors.accent },
  title: { ...typography.display, fontSize: 30, marginTop: 2 },
  dayBadge: {
    width: 52, height: 52, borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center', marginLeft: spacing.sm,
  },
  dayBadgeText: { color: colors.background, fontWeight: '900', fontSize: 16 },

  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.sm },
  sessionBlock: { gap: spacing.sm },
  sessionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.sm },
  sessionTag: { ...typography.label, letterSpacing: 2, fontSize: 10 },
  fixBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.accent + '55',
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.sm + 2, paddingVertical: 6, marginLeft: 'auto',
  },
  fixBtnText: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: colors.accent },

  exCard: { gap: spacing.sm },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surface },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  exInfo: { flex: 1 },
  exName: { ...typography.h3 },
  exMeta: { ...typography.caption, marginTop: 2 },
  check: {
    width: 40, height: 40, borderRadius: radius.full,
    backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center',
  },
  setsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  setPill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.surface, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  setPillLabel: { fontSize: 10, fontWeight: '900', color: colors.accent },
  setPillValue: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
  hint: { ...typography.caption, textAlign: 'center', fontStyle: 'italic', marginTop: spacing.sm },

  modalOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
  modalCard: {
    width: '100%', backgroundColor: colors.backgroundElevated,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.xl, gap: spacing.md,
  },
  modalTitle: { ...typography.h2, fontSize: 19 },
  modalSub: { ...typography.caption, marginTop: -spacing.sm },
  chipsRow: { flexDirection: 'row', gap: spacing.xs + 2 },
  chip: {
    flex: 1, alignItems: 'center', gap: 2,
    paddingVertical: spacing.sm, borderRadius: radius.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipDisabled: { opacity: 0.35 },
  chipDay: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5, color: colors.textMuted },
  chipDayActive: { color: colors.background },
  chipNum: { ...typography.mono, fontSize: 13, color: colors.textPrimary },
  chipNumActive: { color: colors.background },
  modalCancel: { alignSelf: 'center', paddingVertical: spacing.sm },
  modalCancelText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
});
