import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, TextInput, Modal,
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { TrainingDay } from '../../types';
import { fetchFullPlan, fetchLogs, activeDays, groupBySuperseries, PlanDay, PlanExercise } from '../../lib/plan';
import { colors, spacing, radius, typography, fonts } from '../../theme';
import Card from '../../components/common/Card';
import SyncBanner from '../../components/common/SyncBanner';
import ProgressRing from '../../components/common/ProgressRing';
import ExerciseRow, { RowState } from '../../components/client/ExerciseRow';
import { topSetByExercise } from '../../lib/progress';
import { WEEK_DAYS, getCurrentWeek, formatShortDate, weekStartLabel, daysUntilWeek, dateForWeekDay } from '../../lib/weeks';
import { showAlert, showConfirm } from '../../lib/alert';
import { refreshReminders } from '../../lib/notifications';
import { CARDIO_TYPES, CardioLog, fetchCardioLogs, addCardioLog, deleteCardioLog } from '../../lib/cardio';

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
  // la mejor serie registrada por ejercicio, para mostrarla en las filas ya hechas
  const [topSets, setTopSets] = useState<Record<string, { weight: number; reps: number }>>({});
  const [phase, setPhase] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [noteDirty, setNoteDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  // Qué semana es la que está dibujada en pantalla ahora mismo (null = ninguna).
  // Va en ref y no en estado porque `fetchWeek` corre desde el callback de
  // `useFocusEffect`, que captura el render en que cambiaron sus dependencias y
  // no vería el valor más reciente.
  const loadedWeekRef = React.useRef<number | null>(null);
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
    // El spinner es solo para cuando no hay nada que mostrar de esta semana: la
    // carga inicial o un cambio de semana. Un refetch de la semana YA dibujada
    // (volver de registrar un ejercicio, p.ej.) no debe vaciar el árbol: al
    // desmontarse, el anillo se rellena desde 0 en vez de avanzar desde el valor
    // viejo, las filas repiten la cascada, y durante esa cascada quedan táctiles
    // con opacidad 0 y corridas 10px — tocar donde estaba una fila abría otro
    // ejercicio.
    setLoading(loadedWeekRef.current !== week);
    const plan = await fetchFullPlan(user.id, week);
    if (!plan) { setLoading(false); loadedWeekRef.current = null; setDays([]); setNoPlanAtAll(true); setNoPlanForWeek(true); return; }
    setNoPlanAtAll(false);

    setPhase(plan.activeWeek?.is_deload ? 'descarga' : null);
    setNoPlanForWeek(!plan.activeWeek);

    const list = activeDays(plan.days);
    loadedWeekRef.current = list.length > 0 ? week : null;
    setDays(list);

    const logs = await fetchLogs(plan.seriesIds, week);
    applyWeek(list, logs, plan.seriesToExercise, week === currentWeek);

    setLoading(false);
  }

  // recalcula estado (ejercicios hechos, progreso, recordatorios) de la semana ya cargada
  function applyWeek(
    list: PlanDay[],
    logs: { series_id: string; week_number: number; weight: number; reps: number }[],
    seriesToExercise: Record<string, string>,
    isCurrentWeek: boolean,
  ) {
    const loggedSeries = new Set(logs.map(l => l.series_id));
    const doneEx = new Set(
      Object.entries(seriesToExercise).filter(([sid]) => loggedSeries.has(sid)).map(([, exId]) => exId),
    );
    setLoggedExercises(doneEx);
    setTopSets(topSetByExercise(logs, seriesToExercise));

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

  // el primer ejercicio sin registrar es "el siguiente"; el resto, pendientes
  const nextExerciseId = exercises.find(e => !loggedExercises.has(e.id))?.id ?? null;
  const rowState = (exId: string): RowState =>
    loggedExercises.has(exId) ? 'done' : exId === nextExerciseId ? 'next' : 'pending';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.topBar}>
        <Text style={styles.date}>{formatShortDate(new Date().toISOString()).toUpperCase()}</Text>
        {!loading && days.length > 0 && (
          <View style={styles.weekNav}>
            <TouchableOpacity
              onPress={() => setSelectedWeek(w => Math.max(1, w - 1))}
              disabled={selectedWeek <= 1}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={13}
                color={selectedWeek <= 1 ? colors.border : colors.textMuted} />
            </TouchableOpacity>
            <Text style={styles.weekLabel}>SEMANA {selectedWeek}</Text>
            <TouchableOpacity
              onPress={() => setSelectedWeek(w => Math.min(currentWeek, w + 1))}
              disabled={selectedWeek >= currentWeek}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-forward" size={13}
                color={selectedWeek >= currentWeek ? colors.border : colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Sin ejercicios no hay anillo que llenar, pero el nombre del día se
          queda: si no, "PIERNAS" desaparece de la pantalla por completo y el
          alumno no sabe qué día está mirando. */}
      {!loading && days.length > 0 && selectedDay && (
        <View style={exercises.length > 0 ? styles.hero : styles.heroBare}>
          {exercises.length > 0 && (
            <ProgressRing
              done={dayStatus[selectedDay.id]?.done ?? 0}
              total={exercises.length}
            />
          )}
          <Text style={styles.dayName}>{selectedDay.name.toUpperCase()}</Text>
        </View>
      )}

      {/* Fuera del hero: en un día al que el coach todavía no le cargó
          ejercicios el alumno igual tiene que ver que está en descarga. */}
      {!loading && phase && PHASE_INFO[phase] && (
        <View style={[styles.phaseBadge, { borderColor: PHASE_INFO[phase].color }]}>
          <Text style={[styles.phaseText, { color: PHASE_INFO[phase].color }]}>
            FASE · {PHASE_INFO[phase].label}
          </Text>
        </View>
      )}

      {viewingPastWeek && (
        <View style={styles.pastBanner}>
          <Ionicons name="time-outline" size={13} color={colors.textMuted} />
          <Text style={styles.pastBannerText}>
            ¿Se te quedó pendiente un día? Regístralo acá — quedará guardado en la fecha que indiques.
          </Text>
          <TouchableOpacity onPress={() => setSelectedWeek(currentWeek)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.weekNavTodayText}>VOLVER A HOY</Text>
          </TouchableOpacity>
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
                  style={[styles.dayPill, active && styles.dayPillActive, complete && !active && styles.dayPillDone]}
                  onPress={() => selectDay(day)}
                  activeOpacity={0.7}
                >
                  {complete ? (
                    <View style={styles.tabBadge}>
                      <Ionicons name="checkmark-circle" size={11} color={active ? colors.background : colors.textMuted} />
                    </View>
                  ) : isCurrentDay ? (
                    <View style={styles.todayDot} />
                  ) : null}
                  <Text style={[styles.dayPillText, active && styles.dayPillTextActive]}>
                    DÍA {day.day_number}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            <SyncBanner />

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
            {(() => {
              let rowIndex = -1;
              return groupBySuperseries(exercises).map(group => {
                const encadenado = group.exercises.length > 1;
                const etiqueta = group.exercises.length >= 3 ? 'TRISERIE' : 'BISERIE';
                return (
                  <View key={group.key} style={encadenado ? styles.chain : undefined}>
                    {encadenado && <Text style={styles.chainLabel}>{etiqueta}</Text>}
                    {group.exercises.map(ex => {
                      rowIndex += 1;
                      return (
                        <ExerciseRow
                          key={ex.id}
                          exercise={ex}
                          state={rowState(ex.id)}
                          index={rowIndex}
                          topSet={topSets[ex.id]}
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
                        />
                      );
                    })}
                  </View>
                );
              });
            })()}

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

            {/* Cardio: secundario respecto al entrenamiento del día, así que va
                al final y sin fondo — solo un borde que lo delimita. Va DESPUÉS
                de "SIN EJERCICIOS": en un día vacío lo primero que el alumno
                tiene que leer es por qué la pantalla está vacía. */}
            <View style={styles.cardioBlock}>
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
                  <Ionicons name="add" size={13} color={colors.textPrimary} />
                  <Text style={styles.cardioAddBtnText}>CARDIO</Text>
                </TouchableOpacity>
              </View>
              {cardioLogs.length > 0 && (
                <View style={styles.cardioList}>
                  {cardioLogs.map(c => (
                    <TouchableOpacity key={c.id} style={styles.cardioRow} onLongPress={() => removeCardio(c)} activeOpacity={0.7}>
                      <Ionicons name="walk-outline" size={13} color={colors.textMuted} />
                      <Text style={styles.cardioRowText}>{c.type} · {c.duration_minutes} min</Text>
                      <Text style={styles.cardioRowDate}>{formatShortDate(c.logged_at)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
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
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingTop: spacing.xs,
  },
  date: { fontSize: 9, letterSpacing: 2, fontWeight: '800', color: colors.textMuted },
  weekLabel: { fontSize: 9, letterSpacing: 1, fontWeight: '800', color: colors.textMuted },
  hero: { alignItems: 'center', paddingTop: spacing.md, paddingBottom: spacing.sm },
  // mismo bloque sin anillo: el nombre del día solo
  heroBare: { alignItems: 'center', paddingTop: spacing.sm, paddingBottom: spacing.sm },
  dayName: { fontFamily: fonts.display, fontSize: 24, color: colors.textPrimary, letterSpacing: 0.5, marginTop: 2 },
  weekNav: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  weekNavTodayText: { fontSize: 9, fontWeight: '900', letterSpacing: 1, color: colors.textPrimary },
  pastBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    marginHorizontal: spacing.xl, marginBottom: spacing.sm,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs + 2,
  },
  pastBannerText: { ...typography.caption, fontSize: 11, flex: 1, color: colors.textMuted },
  phaseBadge: {
    alignSelf: 'center', marginTop: spacing.xs, marginBottom: spacing.xs,
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

  // Las píldoras necesitan aire propio: quedan entre el nombre del día en
  // Anton 24px y lo que venga abajo — que puede ser una tarjeta sólida, como
  // el aviso de semana completa. Con el padding mínimo se veían aplastadas.
  dayTabsScroll: { flexGrow: 0, marginBottom: spacing.sm },
  dayTabs: { paddingHorizontal: spacing.xl, gap: spacing.sm, alignItems: 'center', paddingVertical: spacing.sm },
  dayPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm + 3, paddingVertical: 4,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
  },
  dayPillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayPillDone: { borderColor: colors.borderLight },
  dayPillText: { fontSize: 9, letterSpacing: 1, fontWeight: '800', color: colors.textMuted },
  dayPillTextActive: { color: colors.background },
  // marcadores en línea, no flotando en la esquina: en una píldora de 19px de
  // alto una insignia absoluta se sale del borde y Android la recorta
  tabBadge: { justifyContent: 'center' },
  todayDot: {
    width: 5, height: 5, borderRadius: 2.5,
    backgroundColor: colors.accent,
  },

  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.xs, paddingBottom: spacing.xl, gap: spacing.sm },
  doneCard: { gap: spacing.sm, marginBottom: spacing.sm },
  doneHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  doneInfo: { flex: 1 },
  doneTitle: { ...typography.displaySm, fontSize: 18, color: colors.accent },
  doneSub: { ...typography.caption, marginTop: 1 },
  doneDivider: { height: 1, backgroundColor: colors.border },
  nextLabel: { ...typography.label, letterSpacing: 2, fontSize: 9 },
  nextText: { ...typography.body, fontSize: 14 },
  nextHint: { ...typography.caption, fontSize: 10, fontStyle: 'italic' },
  chain: {
    borderLeftWidth: 2, borderLeftColor: colors.borderLight,
    paddingLeft: spacing.sm, marginLeft: 2,
  },
  chainLabel: {
    fontSize: 8, fontWeight: '900', letterSpacing: 2,
    color: colors.textMuted, marginTop: spacing.sm,
  },
  cardioBlock: {
    gap: spacing.sm, marginTop: spacing.lg,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md,
  },
  cardioHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardioTitle: { ...typography.label, letterSpacing: 1.5, fontSize: 10 },
  cardioSub: { ...typography.caption, marginTop: 2 },
  cardioAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2, paddingVertical: 5,
  },
  cardioAddBtnText: { fontSize: 10, fontWeight: '900', letterSpacing: 1, color: colors.textPrimary },
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
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  emptyTitle: { ...typography.h2, color: colors.textMuted, marginBottom: spacing.sm },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  noExCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  noExTitle: { ...typography.h3, color: colors.textMuted },
  noExText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
