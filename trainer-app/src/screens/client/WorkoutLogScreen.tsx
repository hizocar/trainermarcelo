import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Image, Modal, AppState,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Exercise, ExerciseSeries, WorkoutLog } from '../../types';
import { colors, spacing, radius, typography, fonts } from '../../theme';
import Card from '../../components/common/Card';
import ScreenHeader from '../../components/common/ScreenHeader';
import SectionLabel from '../../components/common/SectionLabel';
import ExerciseVideo from '../../components/common/ExerciseVideo';
import MuscleMap from '../../components/common/MuscleMap';
import TrendChart from '../../components/common/TrendChart';
import { showAlert, showConfirm } from '../../lib/alert';
import { formatShortDate, dateForWeekDay, WEEK_DAYS_SHORT } from '../../lib/weeks';
import { saveLog } from '../../lib/offline';
import { suggestProgression } from '../../lib/progress';
import { restOptions, secondsLeft, formatRest } from '../../lib/restTimer';
import { scheduleRestAlert, cancelRestAlert } from '../../lib/notifications';
import { necesitaConfirmar, textoConfirmacion } from '../../lib/overwrite';

type RouteParams = { exercise: Exercise; week: number; date?: string; athleteId?: string };

// Lun..Dom — orden de los chips de "¿cuándo lo hiciste?" (getDay(): 0=Dom..6=Sáb)
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

interface SeriesEntry {
  series: ExerciseSeries;
  // texto crudo mientras se edita: guardar números rompe la escritura de decimales ("7." → 7)
  weight: string;
  reps: string;
  rir: string;
  prev?: { weight: number; reps: number; week: number };
  saved: boolean;
  /** Tenía registro al abrir la pantalla: el coach no lo pisa sin confirmar. */
  yaRegistrada: boolean;
  /** El coach ya confirmó reemplazar esta serie en esta visita. */
  desbloqueada: boolean;
}

export default function WorkoutLogScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { exercise, week, date } = route.params as RouteParams;
  const { user } = useAuth();
  // De quién es este entrenamiento. Cuando entra el alumno es él mismo; cuando
  // entra el coach a registrar por su alumno, llega por parámetro. Antes esto y
  // `user.id` eran lo mismo y por eso el archivo los usaba indistintamente.
  const athleteId = (route.params as RouteParams).athleteId ?? user!.id;
  const esPropio = athleteId === user!.id;

  const [logDate, setLogDate] = useState(date ?? new Date().toISOString());
  const [entries, setEntries] = useState<SeriesEntry[]>([]);
  const [history, setHistory] = useState<{ week: number; date?: string; sets: { series: number; weight: number; reps: number }[] }[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showImage, setShowImage] = useState(true);
  const [note, setNote] = useState('');
  const [noteDirty, setNoteDirty] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  // Temporizador de descanso: se guarda el INSTANTE EN QUE TERMINA, no los
  // segundos restantes. iOS suspende los setInterval de JS al bloquear la
  // pantalla —justo lo que uno hace mientras descansa— y el conteo quedaba
  // congelado: el temporizador mentía. Ahora todo se deriva de `restEndsAt`
  // contra la hora actual, y un aviso local cubre el caso de app cerrada.
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restLeft, setRestLeft] = useState(0);
  const restAlertIdRef = React.useRef<string | null>(null);
  // valor original de cada serie al abrir la pantalla (series_id → {weight, reps}):
  // es lo que se muestra en la confirmación, no lo que hay en pantalla mientras
  // el coach edita, porque es lo que se va a perder.
  const currentLogRef = React.useRef<Record<string, { weight: number; reps: number }>>({});
  // token de secuencia: solo el último toque puede escribir `restAlertIdRef`
  const restTokenRef = React.useRef(0);
  const avisoPrevioRef = React.useRef(false);
  const opcionesDescanso = React.useMemo(
    () => restOptions(exercise.rest_seconds),
    [exercise.rest_seconds],
  );

  async function startRestTimer(seconds: number) {
    const token = ++restTokenRef.current;
    const endsAt = Date.now() + seconds * 1000;
    avisoPrevioRef.current = false;
    setRestEndsAt(endsAt);
    setRestLeft(seconds);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // El aviso local es lo único que llega con la pantalla bloqueada.
    //
    // Hay que ESPERAR la cancelación antes de programar: sin el await las dos
    // promesas corren en paralelo y, cuando `restAlertIdRef` es null,
    // `cancelRestAlert` entra en la rama de barrido por `kind === 'rest'` y
    // puede borrar el aviso que se acaba de programar. El ref es null justo en
    // los dos casos que importan —volver a la pantalla tras salir (la biserie)
    // y tocar dos duraciones seguidas para corregirse— y la falla es
    // silenciosa: o no llega el aviso, o queda uno huérfano sonando a mitad de
    // la serie siguiente. El token de secuencia asegura que solo el último
    // toque escriba el ref.
    const anterior = restAlertIdRef.current;
    restAlertIdRef.current = null;
    await cancelRestAlert(anterior);
    if (restTokenRef.current !== token) return;
    const id = await scheduleRestAlert(endsAt);
    if (restTokenRef.current !== token) {
      // otro toque (o una cancelación) mandó mientras programábamos: este aviso
      // ya no corresponde y se cancela por identificador, sin barrer
      await cancelRestAlert(id);
      return;
    }
    restAlertIdRef.current = id;
  }

  function limpiarDescanso() {
    // invalida cualquier programación en vuelo: su `then` se cancelará a sí mismo
    restTokenRef.current++;
    setRestEndsAt(null);
    setRestLeft(0);
    const id = restAlertIdRef.current;
    restAlertIdRef.current = null;
    cancelRestAlert(id);
  }

  function stopRestTimer() {
    limpiarDescanso();
  }

  useEffect(() => {
    if (restEndsAt == null) return;

    let terminado = false;
    const tick = () => {
      if (terminado) return;
      const left = secondsLeft(restEndsAt, Date.now());
      setRestLeft(left);
      if (left <= 0) {
        terminado = true;
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // terminó con la app abierta: el aviso ya no debe llegar
        limpiarDescanso();
      } else if (left <= 3 && !avisoPrevioRef.current) {
        avisoPrevioRef.current = true;
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    };

    tick();
    const id = setInterval(tick, 500);
    // recalcular al volver de segundo plano: el intervalo estuvo suspendido y
    // el conteo se quedó donde estaba al bloquear la pantalla
    const sub = AppState.addEventListener('change', estado => {
      if (estado === 'active') tick();
    });
    return () => { clearInterval(id); sub.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restEndsAt]);

  useEffect(() => {
    fetchSeriesAndLogs();
    fetchNote();
  }, []);

  async function fetchNote() {
    if (!user || !exercise.day_id) return;
    const { data } = await supabase
      .from('session_notes').select('note')
      .eq('user_id', athleteId).eq('day_id', exercise.day_id).eq('week_number', week)
      .maybeSingle();
    setNote(data?.note ?? '');
    setNoteDirty(false);
  }

  async function saveNote() {
    if (!user || !note.trim()) return;
    setNoteSaving(true);
    const { error } = await supabase.from('session_notes').upsert(
      { user_id: athleteId, day_id: exercise.day_id, week_number: week, note: note.trim() },
      { onConflict: 'user_id,day_id,week_number' },
    );
    setNoteSaving(false);
    if (error) showAlert('No se pudo guardar la nota', error.message);
    else setNoteDirty(false);
  }

  async function fetchSeriesAndLogs() {
    const { data: seriesData } = await supabase
      .from('exercise_series')
      .select('*')
      .eq('exercise_id', exercise.id)
      .order('series_number');

    const seriesList: ExerciseSeries[] = seriesData ?? [];
    const seriesIds = seriesList.map(s => s.id);

    if (seriesIds.length === 0) { setLoading(false); return; }

    // todos los logs del ejercicio (para el histórico completo por semana)
    const { data: logsData } = await supabase
      .from('workout_logs')
      .select('*')
      .in('series_id', seriesIds)
      .order('week_number', { ascending: false });

    const currentMap: Record<string, WorkoutLog> = {};
    const prevMap: Record<string, WorkoutLog> = {};
    (logsData ?? []).forEach(l => {
      if (l.week_number === week && !currentMap[l.series_id]) currentMap[l.series_id] = l;
      else if (l.week_number < week && !prevMap[l.series_id]) prevMap[l.series_id] = l;
    });

    // histórico agrupado por semana: qué levantó en cada serie
    const seriesNumById: Record<string, number> = {};
    seriesList.forEach(s => { seriesNumById[s.id] = s.series_number; });
    const byWeek: Record<number, { date?: string; sets: { series: number; weight: number; reps: number }[] }> = {};
    (logsData ?? []).forEach(l => {
      const g = (byWeek[l.week_number] ??= { date: l.logged_at, sets: [] });
      if (l.logged_at && (!g.date || l.logged_at < g.date)) g.date = l.logged_at;
      g.sets.push({ series: seriesNumById[l.series_id] ?? 0, weight: l.weight, reps: l.reps });
    });
    setHistory(
      Object.entries(byWeek)
        .map(([w, g]) => ({ week: Number(w), date: g.date, sets: g.sets.sort((a, b) => a.series - b.series) }))
        .sort((a, b) => b.week - a.week),
    );

    const currentLogSimplified: Record<string, { weight: number; reps: number }> = {};
    Object.entries(currentMap).forEach(([id, l]) => {
      currentLogSimplified[id] = { weight: l.weight, reps: l.reps };
    });
    currentLogRef.current = currentLogSimplified;

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
        yaRegistrada: !!cur,
        desbloqueada: false,
      };
    }));
    setLoading(false);
  }

  function updateEntry(index: number, field: 'weight' | 'reps' | 'rir', value: string) {
    // permitir solo dígitos y un separador decimal (punto o coma)
    const clean = value.replace(/[^0-9.,]/g, '').replace(/([.,].*)[.,]/, '$1');
    const aplicar = (extra?: Partial<SeriesEntry>) =>
      setEntries(prev => prev.map((x, i) => i === index
        ? { ...x, [field]: clean, saved: false, ...extra }
        : x
      ));

    const e = entries[index];
    if (necesitaConfirmar({ esPropio, yaRegistrada: e.yaRegistrada, desbloqueada: e.desbloqueada })) {
      const cur = currentLogRef.current[e.series.id];
      showConfirm(
        'Reemplazar serie',
        textoConfirmacion({
          seriesNumber: e.series.series_number,
          weight: cur?.weight ?? 0,
          reps: cur?.reps ?? 0,
        }),
        // Al confirmar se aplica TAMBIÉN la tecla que disparó la confirmación:
        // si solo se desbloqueara, el campo volvería al valor viejo y el coach
        // tendría que teclear de nuevo con el alumno esperando.
        () => aplicar({ desbloqueada: true }),
        'Reemplazar',
      );
      return;
    }

    aplicar();
  }

  /** ¿Esta serie es del alumno y el coach todavía no confirmó pisarla? */
  function pendienteDeConfirmar(e: SeriesEntry) {
    return necesitaConfirmar({
      esPropio,
      yaRegistrada: e.yaRegistrada,
      desbloqueada: e.desbloqueada,
    });
  }

  const toNum = (s: string) => {
    const n = parseFloat(s.replace(',', '.'));
    return isNaN(n) ? null : n;
  };

  // Guardado automático: antes solo se guardaba al tocar "GUARDAR
  // ENTRENAMIENTO" — si el cliente cambiaba de ejercicio dentro de una
  // biserie/triserie antes de tocar ese botón, perdía todo lo tipeado acá.
  // Ahora cada serie con peso+reps completos se guarda sola (con un
  // pequeño debounce mientras escribe) y además se fuerza un guardado al
  // salir de la pantalla, para no depender de que el debounce alcance a
  // dispararse antes de la navegación.
  const entriesRef = React.useRef(entries);
  React.useEffect(() => { entriesRef.current = entries; }, [entries]);
  const logDateRef = React.useRef(logDate);
  React.useEffect(() => { logDateRef.current = logDate; }, [logDate]);

  async function flushAutoSave() {
    const list = entriesRef.current;
    const toSave = list
      .map((e, i) => ({ i, e, weightNum: toNum(e.weight), repsNum: toNum(e.reps) }))
      // `pendienteDeConfirmar` no debería filtrar nada acá (una serie del alumno
      // sin confirmar nunca queda `saved: false`), pero la regla se escribe en
      // TODOS los caminos de escritura: es la única que protege el registro del
      // alumno de que se lo pisen sin querer.
      .filter(({ e, weightNum, repsNum }) =>
        !e.saved && weightNum != null && repsNum != null && !pendienteDeConfirmar(e));
    if (toSave.length === 0) return;

    for (const { i, e, weightNum, repsNum } of toSave) {
      const rirNum = e.rir === '' ? null : Math.min(9, Math.round(toNum(e.rir) ?? 0));
      await saveLog({
        series_id: e.series.id,
        week_number: week,
        weight: weightNum!,
        reps: repsNum!,
        rir: rirNum,
        logged_at: logDateRef.current,
        logged_by: user!.id,
      });
      setEntries(prev => prev.map((x, xi) => xi === i ? { ...x, saved: true } : x));
    }
  }

  React.useEffect(() => {
    const timer = setTimeout(flushAutoSave, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  // último recurso: si el cliente navega antes de que el debounce dispare
  React.useEffect(() => {
    const sub = navigation.addListener('beforeRemove', () => { flushAutoSave(); });
    return () => { sub(); flushAutoSave(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  // autoprogresión (lógica pura, con tests en lib/progress)
  const suggestion = React.useMemo(() => {
    if (entries.length === 0 || entries.some(e => e.saved)) return null;
    const prevSets = entries.map(e => e.prev).filter(Boolean) as { weight: number; reps: number }[];
    if (prevSets.length !== entries.length) return null;
    return suggestProgression(prevSets, exercise.reps_objective);
  }, [entries, exercise.reps_objective]);

  function applySuggestion() {
    if (!suggestion) return;
    // Las series del alumno que el coach todavía no confirmó reemplazar se
    // dejan como están: la sugerencia no es una confirmación.
    setEntries(prev => prev.map((e, i) => pendienteDeConfirmar(e)
      ? e
      : { ...e, weight: String(suggestion[i]), saved: false }));
  }

  async function saveAll() {
    // Las series que ya venían registradas llegan PRELLENADAS desde currentMap:
    // sin este filtro, guardar reescribía las series 1-3 del alumno con la fecha
    // de hoy y el entrenamiento saltaba de día en el calendario del coach,
    // aunque los números no cambiaran.
    const toSave = entries
      .filter(e => !pendienteDeConfirmar(e))
      .map(e => ({ ...e, weightNum: toNum(e.weight), repsNum: toNum(e.reps), rirNum: e.rir === '' ? null : Math.min(9, Math.round(toNum(e.rir) ?? 0)) }))
      .filter(e => e.weightNum != null && e.repsNum != null);
    if (toSave.length === 0) {
      showAlert('Nada que guardar', 'Ingresa peso y reps en al menos una serie.');
      return;
    }

    setSaving(true);
    let queued = 0;

    for (const entry of toSave) {
      const result = await saveLog({
        series_id: entry.series.id,
        week_number: week,
        weight: entry.weightNum!,
        reps: entry.repsNum!,
        rir: entry.rirNum,
        logged_at: logDate,
        logged_by: user!.id,
      });
      if (result === 'queued') queued++;
    }

    setSaving(false);
    if (queued > 0) {
      showAlert(
        'Guardado sin conexión',
        `Tu entrenamiento quedó guardado en el teléfono y se subirá solo cuando vuelva la señal.`,
        () => navigation.goBack(),
      );
    } else {
      showAlert('¡Guardado!', 'Tu entrenamiento fue registrado.', () => navigation.goBack());
    }
  }

  // datos para el modal de histórico: carga total (Σ peso × reps) por semana
  const chartData = React.useMemo(
    () => history.slice().reverse().map(h => ({
      label: `S${h.week}`,
      value: Math.round(h.sets.reduce((a, s) => a + s.weight * s.reps, 0)),
    })),
    [history],
  );
  const bestPR = React.useMemo(() => {
    let best: { weight: number; reps: number; week: number } | null = null;
    const sc = (w: number, r: number) => w * (1 + r / 30);
    history.forEach(h => h.sets.forEach(s => {
      if (!best || sc(s.weight, s.reps) > sc(best.weight, best.reps)) best = { weight: s.weight, reps: s.reps, week: h.week };
    }));
    return best as { weight: number; reps: number; week: number } | null;
  }, [history]);

  // la primera serie sin guardar es la que el alumno está haciendo ahora
  const indiceActivo = entries.findIndex(e => !e.saved);

  if (loading) return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.accent} style={{ marginTop: 100 }} />
    </View>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        left="ATRÁS"
        onBack={() => navigation.goBack()}
        right={
          <TouchableOpacity onPress={() => setShowHistory(true)} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
            <Text style={styles.headerAction}>HISTORIAL</Text>
          </TouchableOpacity>
        }
      />

      {/* Cabecera fija: queda fuera del ScrollView para que el nombre del
          ejercicio siga visible mientras el alumno registra series. Se sacó la
          cifra grande del peso de referencia; la fecha y el objetivo bajan a
          una línea discreta para que el bloque fijo sea lo más bajo posible —
          con el teclado numérico abierto el alto útil es poco. */}
      <View style={styles.hero}>
        <Text style={styles.exerciseName} numberOfLines={2}>{exercise.name.toUpperCase()}</Text>
        {exercise.name_en ? <Text style={styles.nameEn} numberOfLines={1}>{exercise.name_en}</Text> : null}
        <Text style={styles.heroMeta}>
          {`${formatShortDate(logDate).toUpperCase()} · OBJETIVO ${exercise.reps_objective}`}
        </Text>
      </View>

      {/* automaticallyAdjustKeyboardInsets: con el teclado numérico abierto la
          cabecera fija deja poco alto útil; esto desplaza la lista y mantiene
          visible el campo enfocado sin tocar el diseño */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
      >
        {/* ¿Cuándo lo hiciste? — corrige la fecha real si registras un día atrasado */}
        <View style={styles.whenCard}>
          <Text style={styles.whenLabel}>¿CUÁNDO LO HICISTE?</Text>
          <View style={styles.whenRow}>
            {WEEKDAY_ORDER.map(wd => {
              const d = dateForWeekDay(week, wd);
              const iso = d.toISOString();
              const isFuture = d.getTime() > Date.now();
              const selected = new Date(logDate).toDateString() === d.toDateString();
              return (
                <TouchableOpacity
                  key={wd}
                  style={[styles.whenChip, selected && styles.whenChipActive, isFuture && styles.whenChipDisabled]}
                  onPress={() => !isFuture && setLogDate(iso)}
                  disabled={isFuture}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.whenChipDay, selected && styles.whenChipDayActive]}>{WEEK_DAYS_SHORT[wd]}</Text>
                  <Text style={[styles.whenChipNum, selected && styles.whenChipNumActive]}>{d.getDate()}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        {/* Ejemplo del ejercicio */}
        {(exercise.image_url || exercise.notes || exercise.video_url || exercise.muscle_group) && (
          <Card style={styles.exampleCard}>
            <TouchableOpacity style={styles.exampleHeader} onPress={() => setShowImage(v => !v)}>
              <Text style={styles.exampleTitle}>
                {(exercise.image_url || exercise.video_url || exercise.notes) ? 'MÚSCULO Y TÉCNICA' : 'MÚSCULO TRABAJADO'}
              </Text>
              <Ionicons name={showImage ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
            </TouchableOpacity>
            {showImage && (
              <>
                {exercise.muscle_group && (
                  <>
                    {/* el mapa funde las 3 cabezas de hombro y los 3 glúteos en una
                        sola zona: sin este texto, el alumno no puede distinguir cuál
                        de los tres está trabajando */}
                    <Text style={styles.muscleGroupLabel}>{exercise.muscle_group.toUpperCase()}</Text>
                    <MuscleMap height={172} highlights={{ [exercise.muscle_group]: 1 }} />
                  </>
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
              Completaste el rango la semana pasada — quizá podrías subir un poco más
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.tableHeader}>
          <View style={{ width: 26 }} />
          {/* interpolado en un solo string: SectionLabel acepta un hijo de texto */}
          <SectionLabel style={{ flex: 1, textAlign: 'center' }}>{`PESO (${exercise.unit.toUpperCase()})`}</SectionLabel>
          <SectionLabel style={{ flex: 1, textAlign: 'center' }}>REPS</SectionLabel>
          <SectionLabel style={{ flex: 0.7, textAlign: 'center' }}>RIR</SectionLabel>
          <View style={styles.checkSlot} />
        </View>

        {entries.map((entry, i) => {
          const esActiva = i === indiceActivo;
          return (
            <View key={entry.series.id}>
              <View style={[styles.serieRow, esActiva && styles.serieRowActive]}>
                {/* el atenuado va solo en los campos: el visto de "guardado" es
                    la señal que más importa acá y no puede quedar al 45% */}
                <View style={[styles.serieFields, entry.saved && styles.serieRowSaved]}>
                  <Text style={[styles.serieNum, esActiva && styles.serieNumActive]}>
                    S{entry.series.series_number}
                  </Text>
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
                    style={[styles.input, { flex: 0.7 }]}
                    value={entry.rir}
                    onChangeText={v => updateEntry(i, 'rir', v)}
                    keyboardType="number-pad"
                    placeholder="–"
                    placeholderTextColor={colors.textMuted}
                    maxLength={1}
                  />
                </View>
                {/* ancho reservado siempre: si el visto apareciera y desapareciera,
                    los campos saltarían bajo el dedo al re-editar una serie guardada */}
                <View style={styles.checkSlot}>
                  {entry.saved && <Ionicons name="checkmark" size={14} color={colors.textPrimary} />}
                </View>
              </View>
              {entry.prev && (
                <Text style={styles.prevText}>
                  ÚLTIMA VEZ (S{entry.prev.week}): {entry.prev.weight}{exercise.unit.toUpperCase()} × {entry.prev.reps}
                </Text>
              )}
            </View>
          );
        })}

        {restEndsAt != null ? (
          <TouchableOpacity style={styles.timerActive} onPress={stopRestTimer} activeOpacity={0.8}>
            <Text style={styles.timerCount}>{formatRest(restLeft)}</Text>
            <Text style={styles.timerHint}>DESCANSANDO · TOCA PARA CANCELAR</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.timerBlock}>
            <View style={styles.timerHead}>
              <Ionicons name="timer-outline" size={16} color={colors.accent} />
              <Text style={styles.timerBtnText}>DESCANSO</Text>
            </View>
            <View style={styles.timerOptions}>
              {opcionesDescanso.map(o => (
                <TouchableOpacity
                  key={o.seconds}
                  style={[styles.timerChip, o.sugerida && styles.timerChipSuggested]}
                  onPress={() => { void startRestTimer(o.seconds); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.timerChipText, o.sugerida && styles.timerChipTextSuggested]}>
                    {formatRest(o.seconds)}
                  </Text>
                  {o.sugerida ? <Text style={styles.timerChipTag}>SUGERIDO</Text> : null}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* La nota es del alumno: cuando opera el coach, solo lectura y solo si
            hay algo escrito — no hay campo ni botón de guardar para él. */}
        {(esPropio || note.trim().length > 0) && (
          <Card style={styles.noteCard}>
            <View style={styles.noteHeader}>
              <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.accent} />
              <Text style={styles.noteTitle}>{esPropio ? 'NOTA PARA TU COACH' : 'NOTA DEL ALUMNO'}</Text>
            </View>
            {esPropio ? (
              <>
                <TextInput
                  style={styles.noteInput}
                  value={note}
                  onChangeText={v => { setNote(v); setNoteDirty(true); }}
                  placeholder="ej: sentí molestia en el hombro en la S3..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
                {noteDirty && note.trim().length > 0 ? (
                  <TouchableOpacity style={styles.noteSave} onPress={saveNote} disabled={noteSaving}>
                    <Text style={styles.noteSaveText}>{noteSaving ? 'GUARDANDO...' : 'GUARDAR NOTA'}</Text>
                  </TouchableOpacity>
                ) : note.trim().length > 0 ? (
                  <Text style={styles.noteSaved}>✓ Guardada — tu coach la verá</Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.noteReadOnly}>{note}</Text>
            )}
          </Card>
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

      {/* Modal: histórico del ejercicio */}
      <Modal
        visible={showHistory}
        animationType="slide"
        transparent
        onRequestClose={() => setShowHistory(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowHistory(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>HISTÓRICO DEL EJERCICIO</Text>
                <Text style={styles.modalTitle} numberOfLines={1}>{exercise.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowHistory(false)} style={styles.modalClose}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {history.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Ionicons name="stats-chart-outline" size={36} color={colors.textMuted} />
                <Text style={styles.histEmpty}>Aún no has registrado este ejercicio.{'\n'}Tu progreso aparecerá aquí semana a semana.</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xl }}>
                {bestPR && (
                  <View style={styles.prRow}>
                    <Ionicons name="trophy" size={16} color={colors.accent} />
                    <Text style={styles.prText}>
                      Mejor marca: <Text style={styles.prStrong}>{bestPR.weight}{exercise.unit} × {bestPR.reps}</Text> (S{bestPR.week})
                    </Text>
                  </View>
                )}

                {chartData.length >= 2 && (
                  <View style={styles.chartCard}>
                    <Text style={styles.chartCaption}>CARGA TOTAL POR SEMANA ({exercise.unit})</Text>
                    <TrendChart data={chartData} height={150} unit={exercise.unit} fromZero />
                  </View>
                )}

                {history.map(h => (
                  <View key={h.week} style={styles.histWeek}>
                    <View style={styles.histWeekHead}>
                      <Text style={styles.histWeekLabel}>SEMANA {h.week}</Text>
                      {h.date && <Text style={styles.histWeekDate}>{formatShortDate(h.date)}</Text>}
                    </View>
                    <View style={styles.histSets}>
                      {h.sets.map((s, si) => (
                        <View key={si} style={styles.histPill}>
                          <Text style={styles.histPillLabel}>S{s.series}</Text>
                          <Text style={styles.histPillValue}>{s.weight}{exercise.unit} × {s.reps}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 60,
  },
  headerAction: { fontSize: 9, letterSpacing: 2, fontWeight: '800', color: colors.textMuted },
  hero: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: 2, paddingBottom: spacing.sm },
  heroMeta: { fontSize: 9, letterSpacing: 2, fontWeight: '800', color: colors.textMuted, marginTop: 4 },
  whenCard: { gap: spacing.sm, marginBottom: spacing.sm },
  whenLabel: { ...typography.label, letterSpacing: 1.5, fontSize: 10 },
  whenRow: { flexDirection: 'row', gap: spacing.xs + 2 },
  whenChip: {
    flex: 1, alignItems: 'center', gap: 2,
    paddingVertical: spacing.sm, borderRadius: radius.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  whenChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  whenChipDisabled: { opacity: 0.35 },
  whenChipDay: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5, color: colors.textMuted },
  whenChipDayActive: { color: colors.background },
  whenChipNum: { ...typography.mono, fontSize: 13, color: colors.textPrimary },
  whenChipNumActive: { color: colors.background },
  exerciseName: {
    fontFamily: fonts.display, fontSize: 22, color: colors.textPrimary,
    letterSpacing: 0.5, textAlign: 'center',
  },
  histEmpty: { ...typography.caption, fontStyle: 'italic', textAlign: 'center', lineHeight: 18 },
  histWeek: { gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  histWeekHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  histWeekLabel: { ...typography.label, fontSize: 11, letterSpacing: 1.5, color: colors.textSecondary },
  histWeekDate: { ...typography.caption, fontSize: 10 },
  histSets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  histPill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.surface, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  histPillLabel: { fontSize: 10, fontWeight: '900', color: colors.accent },
  histPillValue: { ...typography.mono, fontSize: 12, color: colors.textPrimary },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
  modalSheet: {
    backgroundColor: colors.backgroundElevated,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.lg,
    maxHeight: '82%',
    borderTopWidth: 1, borderColor: colors.border,
  },
  modalHandle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.borderLight, marginBottom: spacing.md,
  },
  modalHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  modalLabel: { ...typography.label, color: colors.accent, letterSpacing: 1.5, fontSize: 10 },
  modalTitle: { ...typography.h2, fontSize: 22, marginTop: 2 },
  modalClose: {
    width: 34, height: 34, borderRadius: radius.full,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  modalEmpty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  prRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.accentSoft, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.accent + '44',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
  },
  prText: { ...typography.body, fontSize: 14, flex: 1 },
  prStrong: { ...typography.mono, fontWeight: undefined, fontSize: 15, color: colors.accent },
  chartCard: {
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, gap: spacing.xs,
  },
  chartCaption: { ...typography.label, fontSize: 9, letterSpacing: 1.5 },
  nameEn: { ...typography.caption, fontStyle: 'italic', marginTop: -2 },
  suggestionBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    marginBottom: spacing.xs,
  },
  suggestionText: { color: colors.background, fontSize: 12, fontWeight: '800', flex: 1 },
  timerBlock: { gap: spacing.xs, marginTop: spacing.xs },
  timerHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  timerOptions: { flexDirection: 'row', gap: spacing.xs + 2 },
  timerChip: {
    // 44pt reales de alto: en RN el padding del padre no agranda el área
    // táctil del hijo, así que el mínimo va acá.
    flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 1,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.accent + '55',
    paddingHorizontal: spacing.xs,
  },
  timerChipSuggested: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  timerChipText: { ...typography.mono, fontSize: 15, color: colors.accent },
  timerChipTextSuggested: { color: colors.textPrimary },
  timerChipTag: { fontSize: 7, letterSpacing: 1.2, fontWeight: '800', color: colors.textMuted },
  timerBtnText: { ...typography.label, color: colors.accent, letterSpacing: 1.5 },
  timerActive: {
    alignItems: 'center', gap: 2,
    borderRadius: radius.md, backgroundColor: colors.accentSoft,
    borderWidth: 1, borderColor: colors.accent,
    paddingVertical: spacing.sm, marginTop: spacing.xs,
  },
  timerCount: { fontSize: 34, fontWeight: '900', color: colors.accent, fontVariant: ['tabular-nums'] },
  timerHint: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, color: colors.textMuted },
  noteCard: { gap: spacing.sm, marginTop: spacing.sm },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  noteTitle: { ...typography.label, letterSpacing: 2 },
  noteInput: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    color: colors.textPrimary, fontSize: 14, minHeight: 56, textAlignVertical: 'top',
  },
  noteReadOnly: { ...typography.body, color: colors.textPrimary, lineHeight: 20 },
  noteSave: { alignSelf: 'flex-end' },
  noteSaveText: { ...typography.label, color: colors.accent, letterSpacing: 1.5 },
  noteSaved: { ...typography.caption, fontSize: 10, color: colors.success, textAlign: 'right' },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },

  exampleCard: { gap: spacing.sm, marginBottom: spacing.sm },
  exampleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  exampleTitle: { ...typography.label, color: colors.accent, letterSpacing: 2 },
  muscleGroupLabel: { ...typography.label, textAlign: 'center' },
  exampleImage: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  exampleNotes: { ...typography.body, color: colors.textPrimary, lineHeight: 21 },

  tableHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  serieRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: spacing.sm,
  },
  serieFields: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  serieRowSaved: { opacity: 0.45 },
  serieRowActive: { borderTopColor: colors.accent },
  serieNum: { width: 26, fontSize: 10, letterSpacing: 1, fontWeight: '800', color: colors.textMuted },
  // el blanco puro es la única excepción de color: marca la serie en curso
  serieNumActive: { color: '#FFFFFF' },
  checkSlot: { width: 20, alignItems: 'center' },
  prevText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.textMuted,
    paddingLeft: 34,
    paddingTop: 4,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    // 12 + 12 + ~20 de línea ≈ 44pt: mínimo táctil de Apple HIG. RN no propaga
    // el toque desde el padding del padre, así que tiene que estar en el input.
    paddingVertical: 12,
    paddingHorizontal: 9,
    color: colors.textPrimary,
    fontFamily: fonts.mono,
    fontSize: 19,
    textAlign: 'center',
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
