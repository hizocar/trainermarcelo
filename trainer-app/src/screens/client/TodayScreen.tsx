import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, Image, TextInput, Modal,
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { TrainingDay, Exercise } from '../../types';
import { fetchFullPlan, fetchLogs, activeDays, groupBySuperseries, PlanDay, PlanExercise } from '../../lib/plan';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';
import SyncBanner from '../../components/common/SyncBanner';
import { WEEK_DAYS, getCurrentWeek, formatShortDate, weekStartLabel, daysUntilWeek, dateForWeekDay } from '../../lib/weeks';
import { showAlert, showConfirm } from '../../lib/alert';
import { refreshReminders } from '../../lib/notifications';
import { CARDIO_TYPES, CardioLog, fetchCardioLogs, addCardioLog, deleteCardioLog } from '../../lib/cardio';

// Colores estables para biseries/triseries — el mismo texto de grupo siempre
// se ve del mismo color, así el cliente identifica de un vistazo qué
// ejercicios van encadenados sin descanso entre ellos.
const GROUP_COLORS = ['#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#22c55e', '#ef4444'];
function groupColor(group: string) {
  let h = 0;
  for (let i = 0; i < group.length; i++) h = (h * 31 + group.charCodeAt(i)) >>> 0;
  return GROUP_COLORS[h % GROUP_COLORS.length];
}

// atajos para no tener que abrir el teclado en el caso común
const CARDIO_QUICK_MINUTES = [15, 20, 30, 45, 60];

const PHASE_INFO: Record<string, { label: string; color: string }> = {
  acumulacion: { label: 'ACUMULACIÓN', color: colors.accent },
  intensificacion: { label: 'INTENSIFICACIÓN', color: colors.textSecondary },
  descarga: { label: 'DESCARGA', color: colors.textMuted },
};

export default function TodayScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [days, setDays] = useState<PlanDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<PlanDay | null>(null);
  const selectedIdRef = React.useRef<string | null>(null);
  const [exercises, setExercises] = useState<PlanExercise[]>([]);
  const [loggedExercises, setLoggedExercises] = useState<Set<string>>(new Set());
  const [dayStatus, setDayStatus] = useState<Record<string, { total: number; done: number }>>({});
  const [phase, setPhase] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [noteDirty, setNoteDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  // null mientras carga; false = hay semana definida; true = el coach no
  // planificó esta semana calendario (ni hay una anterior marcada "repetir")
  const [noPlanForWeek, setNoPlanForWeek] = useState(false);
  const [noPlanAtAll, setNoPlanAtAll] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeek());
  const [cardioLogs, setCardioLogs] = useState<CardioLog[]>([]);
  const [showCardioModal, setShowCardioModal] = useState(false);
  const [cardioType, setCardioType] = useState(CARDIO_TYPES[0]);
  const [cardioMinutes, setCardioMinutes] = useState('');
  const [cardioSaving, setCardioSaving] = useState(false);

  const todayWeekDay = new Date().getDay(); // 0=Dom...6=Sáb
  const currentWeek = getCurrentWeek();
  const viewingPastWeek = selectedWeek !== currentWeek;

  // cada semana es un plan independiente: hay que volver a pedirlo al
  // cambiar de semana, no solo recalcular los checks localmente
  useFocusEffect(useCallback(() => { if (user?.id) fetchWeek(selectedWeek); }, [user?.id, selectedWeek]));
  useFocusEffect(useCallback(() => { if (user?.id) loadCardio(); }, [user?.id]));

  async function loadCardio() {
    if (!user?.id) return;
    setCardioLogs(await fetchCardioLogs(user.id, 7));
  }

  async function saveCardio() {
    if (!user?.id) return;
    const minutes = parseInt(cardioMinutes, 10);
    if (!minutes || minutes <= 0) { showAlert('Falta la duración', 'Ingresa cuántos minutos hiciste.'); return; }
    setCardioSaving(true);
    const { error } = await addCardioLog({
      user_id: user.id, type: cardioType, duration_minutes: minutes, logged_at: new Date().toISOString(),
    });
    setCardioSaving(false);
    if (error) { showAlert('No se pudo guardar', error.message); return; }
    setCardioMinutes('');
    setShowCardioModal(false);
    loadCardio();
  }

  function removeCardio(log: CardioLog) {
    showConfirm('Eliminar registro', `¿Borrar "${log.type}" (${log.duration_minutes} min)?`, async () => {
      await deleteCardioLog(log.id);
      loadCardio();
    }, 'Eliminar');
  }

  async function fetchWeek(week: number) {
    if (!user?.id) return;
    setLoading(true);
    const plan = await fetchFullPlan(user.id, week);
    if (!plan) { setLoading(false); setDays([]); setNoPlanAtAll(true); setNoPlanForWeek(true); return; }
    setNoPlanAtAll(false);

    setPhase(plan.activeWeek?.is_deload ? 'descarga' : null);
    setNoPlanForWeek(!plan.activeWeek);

    const list = activeDays(plan.days);
    setDays(list);

    const logs = await fetchLogs(plan.seriesIds, week);
    applyWeek(list, logs, plan.seriesToExercise, week === currentWeek);

    setLoading(false);
  }

  // recalcula estado (ejercicios hechos, progreso, recordatorios) de la semana ya cargada
  function applyWeek(
    list: PlanDay[],
    logs: { series_id: string; week_number: number }[],
    seriesToExercise: Record<string, string>,
    isCurrentWeek: boolean,
  ) {
    const loggedSeries = new Set(logs.map(l => l.series_id));
    const doneEx = new Set(
      Object.entries(seriesToExercise).filter(([sid]) => loggedSeries.has(sid)).map(([, exId]) => exId),
    );
    setLoggedExercises(doneEx);

    const status: Record<string, { total: number; done: number }> = {};
    list.forEach(d => {
      status[d.id] = {
        total: d.exercises.length,
        done: d.exercises.filter(e => doneEx.has(e.id)).length,
      };
    });
    setDayStatus(status);

    // los recordatorios solo se tocan viendo la semana REAL de hoy — navegar
    // semanas pasadas no debería reprogramar notificaciones
    if (isCurrentWeek) {
      refreshReminders(list.map(d => {
        const st = status[d.id];
        return { id: d.id, day_number: d.day_number, name: d.name, week_day: d.week_day, done: !!st && st.total > 0 && st.done >= st.total };
      }));
    }

    // selección: conservar la elección manual; si no hay, el primer día incompleto
    const isDayComplete = (d: PlanDay) =>
      (status[d.id]?.total ?? 0) > 0 && status[d.id].done >= status[d.id].total;

    const prevId = selectedIdRef.current;
    const kept = prevId ? list.find(d => d.id === prevId) : undefined;
    const firstIncomplete = list.find(d => !isDayComplete(d));
    const selected = kept ?? firstIncomplete ?? list.find(d => d.week_day === todayWeekDay) ?? list[0] ?? null;
    selectedIdRef.current = selected?.id ?? null;
    setSelectedDay(selected);
    setExercises(selected?.exercises ?? []);
    if (selected) loadNote(selected.id);
  }

  async function loadNote(dayId: string) {
    const { data } = await supabase
      .from('session_notes').select('note')
      .eq('user_id', user!.id).eq('day_id', dayId).eq('week_number', selectedWeek)
      .maybeSingle();
    setNote(data?.note ?? '');
    setNoteDirty(false);
  }

  function selectDay(day: PlanDay) {
    selectedIdRef.current = day.id;
    setSelectedDay(day);
    setExercises(day.exercises);
    loadNote(day.id);
  }

  async function saveNote() {
    if (!selectedDay || !note.trim()) return;
    const { error } = await supabase.from('session_notes').upsert(
      { user_id: user!.id, day_id: selectedDay.id, week_number: selectedWeek, note: note.trim() },
      { onConflict: 'user_id,day_id,week_number' },
    );
    if (error) showAlert('No se pudo guardar', error.message);
    else setNoteDirty(false);
  }

  const isToday = (day: TrainingDay) => !viewingPastWeek && day.week_day === todayWeekDay;

  // ¿todos los días del plan completados en la semana que se está viendo?
  const weekComplete = days.length > 0 && days.every(d => {
    const st = dayStatus[d.id];
    return st && st.total > 0 && st.done >= st.total;
  });
  const nextWeek = currentWeek + 1;
  const daysToNext = daysUntilWeek(nextWeek);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            {formatShortDate(new Date().toISOString()).toUpperCase()}
          </Text>
          <Text style={styles.userName}>{user?.name?.split(' ')[0].toUpperCase()}</Text>
          {phase && PHASE_INFO[phase] && (
            <View style={[styles.phaseBadge, { borderColor: PHASE_INFO[phase].color }]}>
              <Text style={[styles.phaseText, { color: PHASE_INFO[phase].color }]}>
                FASE · {PHASE_INFO[phase].label}
              </Text>
            </View>
          )}
        </View>
        {selectedDay && (
          <View style={[styles.weekBadge, isToday(selectedDay) && styles.weekBadgeToday]}>
            <Text style={[styles.weekBadgeText, !isToday(selectedDay) && styles.weekBadgeTextIdle]}>
              D{selectedDay.day_number}
            </Text>
          </View>
        )}
      </View>

      {!loading && days.length > 0 && (
        <View style={styles.weekNav}>
          <TouchableOpacity
            style={styles.weekNavBtn}
            onPress={() => setSelectedWeek(w => Math.max(1, w - 1))}
            disabled={selectedWeek <= 1}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={16} color={selectedWeek <= 1 ? colors.textMuted : colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.weekNavLabel}>
            SEMANA {selectedWeek}{viewingPastWeek ? ' · PASADA' : ''}
          </Text>
          <TouchableOpacity
            style={styles.weekNavBtn}
            onPress={() => setSelectedWeek(w => Math.min(currentWeek, w + 1))}
            disabled={selectedWeek >= currentWeek}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-forward" size={16} color={selectedWeek >= currentWeek ? colors.textMuted : colors.textPrimary} />
          </TouchableOpacity>
          {viewingPastWeek && (
            <TouchableOpacity style={styles.weekNavToday} onPress={() => setSelectedWeek(currentWeek)}>
              <Text style={styles.weekNavTodayText}>VOLVER A HOY</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {viewingPastWeek && (
        <View style={styles.pastBanner}>
          <Ionicons name="time-outline" size={14} color={colors.accent} />
          <Text style={styles.pastBannerText}>
            ¿Se te quedó pendiente un día? Regístralo acá — quedará guardado en la fecha que indiques.
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : days.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>{noPlanAtAll ? 'SIN PLAN' : `SIN PLAN · SEMANA ${selectedWeek}`}</Text>
          <Text style={styles.emptyText}>
            {noPlanAtAll
              ? 'Tu coach aún no ha configurado tu plan de entrenamiento.'
              : 'Tu coach todavía no planificó esta semana. Prueba mirando otra semana con las flechas de arriba.'}
          </Text>
        </View>
      ) : (
        <>
          {/* Selector de días */}
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            style={styles.dayTabsScroll}
            contentContainerStyle={styles.dayTabs}
          >
            {days.map(day => {
              const active = selectedDay?.id === day.id;
              const isCurrentDay = isToday(day);
              const st = dayStatus[day.id];
              const complete = !!st && st.total > 0 && st.done >= st.total;
              return (
                <TouchableOpacity
                  key={day.id}
                  style={[styles.dayTab, active && styles.dayTabActive, complete && !active && styles.dayTabDone]}
                  onPress={() => selectDay(day)}
                  activeOpacity={0.7}
                >
                  {complete ? (
                    <View style={styles.tabBadge}>
                      <Ionicons name="checkmark-circle" size={15} color={active ? colors.background : colors.success} />
                    </View>
                  ) : isCurrentDay ? (
                    <View style={styles.todayDot} />
                  ) : null}
                  <Text style={[styles.dayTabNum, active && styles.dayTabNumActive]}>
                    DÍA {day.day_number}
                  </Text>
                  <Text style={[styles.dayTabName, active && styles.dayTabNameActive]} numberOfLines={1}>
                    {day.name.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* barra de progreso del día */}
          {exercises.length > 0 && selectedDay && (
            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.round(((dayStatus[selectedDay.id]?.done ?? 0) / exercises.length) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressCount}>
                {dayStatus[selectedDay.id]?.done ?? 0}/{exercises.length}
              </Text>
            </View>
          )}

          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            <SyncBanner />

            <Card style={styles.cardioCard}>
              <View style={styles.cardioHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardioTitle}>CARDIO · ÚLTIMOS 7 DÍAS</Text>
                  <Text style={styles.cardioSub}>
                    {cardioLogs.length === 0
                      ? 'Sin registros todavía'
                      : `${cardioLogs.length} sesión${cardioLogs.length === 1 ? '' : 'es'} · ${cardioLogs.reduce((a, c) => a + c.duration_minutes, 0)} min`}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.cardioAddBtn}
                  onPress={() => { setCardioType(CARDIO_TYPES[0]); setCardioMinutes(''); setShowCardioModal(true); }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={16} color={colors.background} />
                  <Text style={styles.cardioAddBtnText}>CARDIO</Text>
                </TouchableOpacity>
              </View>
              {cardioLogs.length > 0 && (
                <View style={styles.cardioList}>
                  {cardioLogs.map(c => (
                    <TouchableOpacity key={c.id} style={styles.cardioRow} onLongPress={() => removeCardio(c)} activeOpacity={0.7}>
                      <Ionicons name="walk-outline" size={14} color={colors.accent} />
                      <Text style={styles.cardioRowText}>{c.type} · {c.duration_minutes} min</Text>
                      <Text style={styles.cardioRowDate}>{formatShortDate(c.logged_at)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </Card>

            {weekComplete && !viewingPastWeek && (
              <Card highlight style={styles.doneCard}>
                <View style={styles.doneHeader}>
                  <Ionicons name="trophy" size={22} color={colors.accent} />
                  <View style={styles.doneInfo}>
                    <Text style={styles.doneTitle}>¡SEMANA {currentWeek} COMPLETA!</Text>
                    <Text style={styles.doneSub}>
                      Terminaste los {days.length} días de entrenamiento 💪
                    </Text>
                  </View>
                </View>

                <View style={styles.doneDivider} />

                <Text style={styles.nextLabel}>LO QUE VIENE</Text>
                <Text style={styles.nextText}>
                  {daysToNext === 0
                    ? `La semana ${nextWeek} ya empezó — registra tu Día 1 cuando entrenes.`
                    : daysToNext === 1
                      ? `La semana ${nextWeek} empieza mañana (${weekStartLabel(nextWeek)}).`
                      : `La semana ${nextWeek} empieza el ${weekStartLabel(nextWeek)} (en ${daysToNext} días).`}
                </Text>
                <Text style={styles.nextHint}>
                  Mientras tanto puedes revisar o corregir lo que registraste tocando cualquier ejercicio.
                </Text>
              </Card>
            )}
            {groupBySuperseries(exercises).map(group => {
              const color = group.superseries ? groupColor(group.superseries) : null;
              const body = group.exercises.map(ex => {
                const done = loggedExercises.has(ex.id);
                return (
                  <TouchableOpacity
                    key={ex.id}
                    onPress={() => navigation.navigate('WorkoutLog', {
                      exercise: ex,
                      week: selectedWeek,
                      // Registrando en vivo (semana actual): la fecha es HOY de
                      // verdad, sin importar qué día de la semana le toca a este
                      // entrenamiento en el split — si lo entrenaste antes o
                      // después de lo calendarizado, igual queda con la fecha
                      // real. Solo al ponerse al día con una semana PASADA tiene
                      // sentido usar la fecha calendarizada de ese día (acá sí
                      // se puede corregir a mano con los chips "¿cuándo lo
                      // hiciste?" si hace falta).
                      date: viewingPastWeek && selectedDay?.week_day != null
                        ? dateForWeekDay(selectedWeek, selectedDay.week_day).toISOString()
                        : new Date().toISOString(),
                    })}
                    activeOpacity={0.7}
                  >
                    <Card style={done ? { ...styles.exerciseCard, ...styles.exerciseCardDone } : styles.exerciseCard}>
                      <View style={styles.exerciseRow}>
                        {ex.image_url ? (
                          <Image source={{ uri: ex.image_url }} style={styles.thumb} />
                        ) : (
                          <View style={[styles.thumb, styles.thumbPlaceholder]}>
                            <Ionicons name="barbell-outline" size={22} color={colors.textMuted} />
                          </View>
                        )}
                        <View style={styles.exerciseInfo}>
                          <Text style={styles.exerciseName}>{ex.name}</Text>
                          <Text style={styles.exerciseMeta}>
                            {ex.muscle_group ? `${ex.muscle_group} · ` : ''}
                            {ex.exercise_series.length} series · {ex.reps_objective} reps
                            {ex.ref_weight ? ` · ref ${ex.ref_weight}${ex.unit}` : ''}
                          </Text>
                        </View>
                        <View style={[styles.logBtn, done && styles.logBtnDone]}>
                          <Ionicons name={done ? 'checkmark' : 'add'} size={22} color={colors.background} />
                        </View>
                      </View>
                    </Card>
                  </TouchableOpacity>
                );
              });

              if (!color) return <React.Fragment key={group.key}>{body}</React.Fragment>;

              return (
                <View key={group.key} style={[styles.superGroup, { borderColor: color }]}>
                  <View style={[styles.superGroupTag, { backgroundColor: color }]}>
                    <Ionicons name="link" size={11} color={colors.background} />
                    <Text style={styles.superGroupTagText}>
                      {group.exercises.length >= 3 ? 'TRISERIE' : 'BISERIE'} {group.superseries}
                    </Text>
                  </View>
                  <View style={{ gap: spacing.sm }}>{body}</View>
                </View>
              );
            })}

            {exercises.length > 0 && selectedDay && (
              <Card style={styles.noteCard}>
                <Text style={styles.noteTitle}>NOTA PARA TU COACH</Text>
                <TextInput
                  style={styles.noteInput}
                  value={note}
                  onChangeText={v => { setNote(v); setNoteDirty(true); }}
                  placeholder="ej: sentí molestia en el hombro en la S3..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
                {noteDirty && note.trim().length > 0 && (
                  <TouchableOpacity style={styles.noteSave} onPress={saveNote}>
                    <Text style={styles.noteSaveText}>GUARDAR NOTA</Text>
                  </TouchableOpacity>
                )}
                {!noteDirty && note.trim().length > 0 && (
                  <Text style={styles.noteSaved}>✓ Guardada — tu coach la verá</Text>
                )}
              </Card>
            )}

            {exercises.length === 0 && selectedDay && (
              <Card style={styles.noExCard}>
                <Text style={styles.noExTitle}>SIN EJERCICIOS</Text>
                <Text style={styles.noExText}>
                  Tu coach aún no ha agregado ejercicios para el {selectedDay.week_day != null ? WEEK_DAYS[selectedDay.week_day] : `Día ${selectedDay.day_number}`}.
                </Text>
              </Card>
            )}
          </ScrollView>
        </>
      )}

      {/* Centrado verticalmente + KeyboardAvoidingView: antes se abría pegado
          abajo y el teclado numérico tapaba el campo de minutos. Además los
          atajos de minutos evitan tener que abrir el teclado casi siempre. */}
      <Modal visible={showCardioModal} transparent animationType="fade" onRequestClose={() => setShowCardioModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>REGISTRAR CARDIO</Text>
              <Text style={styles.inputLabel}>TIPO</Text>
              <View style={styles.cardioTypeRow}>
                {CARDIO_TYPES.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.cardioTypeChip, cardioType === t && styles.cardioTypeChipActive]}
                    onPress={() => setCardioType(t)}
                  >
                    <Text style={[styles.cardioTypeChipText, cardioType === t && styles.cardioTypeChipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.inputLabel}>MINUTOS</Text>
              <View style={styles.cardioTypeRow}>
                {CARDIO_QUICK_MINUTES.map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.cardioTypeChip, cardioMinutes === String(m) && styles.cardioTypeChipActive]}
                    onPress={() => { setCardioMinutes(String(m)); Keyboard.dismiss(); }}
                  >
                    <Text style={[styles.cardioTypeChipText, cardioMinutes === String(m) && styles.cardioTypeChipTextActive]}>{m}′</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.modalInput}
                value={cardioMinutes}
                onChangeText={(v) => setCardioMinutes(v.replace(/[^0-9]/g, ''))}
                placeholder="u otra cantidad de minutos"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowCardioModal(false)}>
                  <Text style={styles.modalCancelBtnText}>CANCELAR</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={saveCardio} disabled={cardioSaving}>
                  {cardioSaving
                    ? <ActivityIndicator color={colors.background} size="small" />
                    : <Text style={styles.modalConfirmBtnText}>GUARDAR</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: spacing.xl, marginBottom: spacing.lg,
  },
  greeting: { ...typography.label, letterSpacing: 2, color: colors.accent },
  userName: { ...typography.display, fontSize: 34, marginTop: 2 },
  weekBadge: {
    width: 52, height: 52, borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  weekBadgeToday: { backgroundColor: colors.accent, borderColor: colors.accent },
  weekBadgeText: { color: colors.background, fontWeight: '900', fontSize: 16 },
  weekBadgeTextIdle: { color: colors.accent },
  weekNav: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.xl, marginBottom: spacing.sm,
  },
  weekNavBtn: {
    width: 30, height: 30, borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  weekNavLabel: { ...typography.label, letterSpacing: 1.5, fontSize: 11 },
  weekNavToday: {
    marginLeft: 'auto',
    borderWidth: 1, borderColor: colors.accent, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  weekNavTodayText: { fontSize: 9, fontWeight: '900', letterSpacing: 1, color: colors.accent },
  pastBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    marginHorizontal: spacing.xl, marginBottom: spacing.sm,
    backgroundColor: colors.accentSoft, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.accent + '33',
    paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs + 2,
  },
  pastBannerText: { ...typography.caption, fontSize: 11, flex: 1, color: colors.textSecondary },
  phaseBadge: {
    alignSelf: 'flex-start', marginTop: spacing.xs,
    borderWidth: 1, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  phaseText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  noteCard: { gap: spacing.sm, marginTop: spacing.sm },
  noteTitle: { ...typography.label, letterSpacing: 2 },
  noteInput: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    color: colors.textPrimary, fontSize: 14, minHeight: 60, textAlignVertical: 'top',
  },
  noteSave: { alignSelf: 'flex-end' },
  noteSaveText: { ...typography.label, color: colors.accent, letterSpacing: 1.5 },
  noteSaved: { ...typography.caption, fontSize: 10, color: colors.success, textAlign: 'right' },

  dayTabsScroll: { flexGrow: 0, marginBottom: spacing.xs },
  dayTabs: { paddingHorizontal: spacing.xl, gap: spacing.sm, alignItems: 'center', paddingVertical: spacing.xs },
  dayTab: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md, paddingBottom: spacing.sm,
    justifyContent: 'center',
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: 'center', minWidth: 82, maxWidth: 140, position: 'relative',
  },
  dayTabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayTabDone: { borderColor: colors.success + '88' },
  tabBadge: { position: 'absolute', top: 5, right: 6 },
  todayDot: {
    position: 'absolute', top: 4, right: 6,
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: colors.accent,
  },
  dayTabNum: { fontSize: 12, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.5 },
  dayTabNumActive: { color: colors.background },
  dayTabName: { fontSize: 9, fontWeight: '700', color: colors.textMuted, marginTop: 2 },
  dayTabNameActive: { color: colors.background },

  dayIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.sm,
  },
  progressRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.xl, marginBottom: spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  progressCount: { fontSize: 11, fontWeight: '900', color: colors.accent, letterSpacing: 0.5 },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },

  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.sm },
  doneCard: { gap: spacing.sm, marginBottom: spacing.sm },
  doneHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  doneInfo: { flex: 1 },
  doneTitle: { ...typography.displaySm, fontSize: 18, color: colors.accent },
  doneSub: { ...typography.caption, marginTop: 1 },
  doneDivider: { height: 1, backgroundColor: colors.border },
  nextLabel: { ...typography.label, letterSpacing: 2, fontSize: 9 },
  nextText: { ...typography.body, fontSize: 14 },
  nextHint: { ...typography.caption, fontSize: 10, fontStyle: 'italic' },
  superGroup: {
    borderWidth: 1.5, borderRadius: radius.md,
    padding: spacing.sm, marginBottom: spacing.sm, gap: spacing.sm,
  },
  superGroupTag: {
    flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 4,
    borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  superGroupTagText: { fontSize: 9, fontWeight: '900', letterSpacing: 1, color: colors.background },
  cardioCard: { gap: spacing.sm, marginBottom: spacing.sm },
  cardioHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardioTitle: { ...typography.label, letterSpacing: 1.5, fontSize: 10 },
  cardioSub: { ...typography.caption, marginTop: 2 },
  cardioAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.accent, borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2, paddingVertical: 7,
  },
  cardioAddBtnText: { fontSize: 10, fontWeight: '900', letterSpacing: 1, color: colors.background },
  cardioList: { gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  cardioRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  cardioRowText: { ...typography.caption, flex: 1, color: colors.textPrimary },
  cardioRowDate: { ...typography.caption, fontSize: 10 },
  cardioTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cardioTypeChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  cardioTypeChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  cardioTypeChipText: { ...typography.caption, color: colors.textMuted, fontWeight: '700' },
  cardioTypeChipTextActive: { color: colors.background },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center', paddingHorizontal: spacing.lg,
  },
  modalBox: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.xl, gap: spacing.md,
  },
  modalTitle: { ...typography.h2, marginBottom: spacing.sm },
  inputLabel: { ...typography.label, letterSpacing: 2, marginBottom: -spacing.sm },
  modalInput: {
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md, color: colors.textPrimary, fontSize: 15,
  },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  modalCancelBtn: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  modalCancelBtnText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
  modalConfirmBtn: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderRadius: radius.md, backgroundColor: colors.accent },
  modalConfirmBtnText: { color: colors.background, fontWeight: '900', fontSize: 13, letterSpacing: 2 },
  exerciseCard: { },
  exerciseCardDone: { borderColor: colors.accent + '66' },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  thumb: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surface },
  thumbPlaceholder: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  exerciseInfo: { flex: 1 },
  superTag: { ...typography.caption, color: colors.accent, marginBottom: 2 },
  exerciseName: { ...typography.h3 },
  exerciseMeta: { ...typography.caption, marginTop: 2 },
  logBtn: {
    width: 40, height: 40, borderRadius: radius.full,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  logBtnDone: { backgroundColor: colors.success },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  emptyTitle: { ...typography.h2, color: colors.textMuted, marginBottom: spacing.sm },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  noExCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  noExTitle: { ...typography.h3, color: colors.textMuted },
  noExText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
