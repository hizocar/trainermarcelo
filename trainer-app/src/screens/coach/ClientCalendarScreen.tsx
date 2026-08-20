import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { User } from '../../types';
import { fetchPlanWeeks, resolveActiveWeek, PlanWeek } from '../../lib/plan';
import {
  WEEK_DAYS_SHORT, calendarWeekNumberForDate, weekDates, localDateKey,
  monthGrid, offScheduleDayKeys,
} from '../../lib/weeks';
import { estadoDeCelda, EstadoCelda } from '../../lib/calendarCell';
import { colors, spacing, radius, typography, fonts } from '../../theme';
import Card from '../../components/common/Card';

// Calendario mensual de UN alumno: qué entrenamiento tocaba cada día según el
// plan, y si lo cumplió. Solo lectura — editar se sigue haciendo en "Editar
// plan · Semanas". Paridad con web/src/app/clients/[id]/calendar/page.tsx —
// misma lógica de estado por celda (ver lib/calendarCell.ts), portada acá
// tal cual salió de la revisión que encontró sus cinco defectos.

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const CABECERA = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

type RouteParams = { client: User };

interface DayRow {
  id: string;
  name: string;
  week_day: number;
  plan_week_id: string;
  exerciseIds: string[];
}

/** "mié 12": día corto + número, para la nota "movido al ..." */
function shortWeekday(d: Date): string {
  return `${WEEK_DAYS_SHORT[d.getDay()].toLowerCase()} ${d.getDate()}`;
}

export default function ClientCalendarScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { client } = route.params as RouteParams;

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexado, como Date

  const [loading, setLoading] = useState(true);
  const [hasPlan, setHasPlan] = useState(false);
  const [hasAnyDay, setHasAnyDay] = useState(false);
  const [trainingDays, setTrainingDays] = useState<DayRow[]>([]);
  const [planWeeks, setPlanWeeks] = useState<PlanWeek[]>([]);
  const [doneByDay, setDoneByDay] = useState<Map<string, Set<string>>>(new Map());
  const [cardioByDay, setCardioByDay] = useState<Map<string, number>>(new Map());
  const [logsError, setLogsError] = useState(false);

  useEffect(() => { load(year, month); }, [year, month]);

  async function load(y: number, m: number) {
    setLoading(true);
    setLogsError(false);

    try {
      await loadInner(y, m);
    } catch (e: any) {
      // Un fallo acá (por ejemplo, fetchPlanWeeks) NO puede disfrazarse de
      // "nada planificado": se limpia lo que ya se había cargado de otro mes
      // y se avisa en pantalla, reusando el mismo aviso que el de registros.
      console.error('calendario: error cargando el calendario del mes', e);
      setTrainingDays([]);
      setPlanWeeks([]);
      setDoneByDay(new Map());
      setCardioByDay(new Map());
      setHasAnyDay(false);
      setLogsError(true);
    } finally {
      setLoading(false);
    }
  }

  async function loadInner(y: number, m: number) {
    const grid = monthGrid(y, m);
    // Acumula si CUALQUIERA de las consultas de este mes falló. Antes solo
    // el error de `workout_logs` prendía el aviso en pantalla; un fallo en
    // `plan`, `days` o `anyDay` se tragaba en un console.error y el mes se
    // dibujaba vacío — indistinguible de un alumno sin nada planificado.
    let anyQueryError = false;

    const { data: plan, error: planError } = await supabase
      .from('workout_plans').select('id').eq('client_id', client.id).maybeSingle();
    if (planError) {
      console.error('calendario: error cargando el plan', planError);
      anyQueryError = true;
    }
    setHasPlan(!!plan);

    const weeks = plan ? await fetchPlanWeeks(plan.id) : [];
    setPlanWeeks(weeks);

    // semana de programa de cada celda visible (null = antes del epoch, no
    // se clampea a la semana 1) y qué plan_week activa corresponde a cada
    // una — se resuelve ANTES de pedir los días, para no traer más que las
    // semanas que se ven en esta grilla.
    const weekNumByCell = new Map<string, number | null>();
    grid.flat().forEach(d => weekNumByCell.set(localDateKey(d), calendarWeekNumberForDate(d)));
    const weekNumbers = Array.from(new Set(
      Array.from(weekNumByCell.values()).filter((w): w is number => w != null),
    ));
    const activeWeekByWeekNum = new Map<number, PlanWeek | null>();
    weekNumbers.forEach(w => activeWeekByWeekNum.set(w, resolveActiveWeek(weeks, w)));
    const visiblePlanWeekIds = Array.from(new Set(
      Array.from(activeWeekByWeekNum.values()).filter((w): w is PlanWeek => w != null).map(w => w.id),
    ));

    // acotada a las semanas de programa visibles en la grilla (nunca crece
    // con el número de series del plan)
    const { data: daysData, error: daysError } = visiblePlanWeekIds.length
      ? await supabase
          .from('training_days')
          .select('id, name, week_day, archived, plan_week_id, exercises ( id, archived, exercise_series ( id ) )')
          .in('plan_week_id', visiblePlanWeekIds)
      : { data: [], error: null };
    if (daysError) {
      console.error('calendario: error cargando días de entrenamiento', daysError);
      anyQueryError = true;
    }

    const days: DayRow[] = (daysData ?? [])
      .filter((d: any) => !d.archived && !d.name.toLowerCase().includes('libre'))
      .map((d: any) => ({
        id: d.id,
        name: d.name,
        week_day: d.week_day,
        plan_week_id: d.plan_week_id,
        exerciseIds: (d.exercises ?? []).filter((e: any) => !e.archived).map((e: any) => e.id),
      }));
    setTrainingDays(days);

    // series_id -> exercise_id, para agrupar registros por ejercicio
    const exBySeries = new Map<string, string>();
    (daysData ?? []).forEach((d: any) =>
      (d.exercises ?? []).filter((e: any) => !e.archived).forEach((e: any) =>
        (e.exercise_series ?? []).forEach((s: any) => exBySeries.set(s.id, e.id))));

    // el plan puede tener días planificados en OTRAS semanas (fuera del mes
    // que se está mirando) — igual hay que dibujar la grilla, solo viene
    // vacía este mes. Consulta liviana e independiente de la de arriba.
    const { data: anyDay, error: anyDayError } = plan
      ? await supabase.from('training_days').select('id').eq('plan_id', plan.id).limit(1).maybeSingle()
      : { data: null, error: null };
    if (anyDayError) {
      console.error('calendario: error verificando días del plan', anyDayError);
      anyQueryError = true;
    }
    setHasAnyDay(!!anyDay);

    // Bordes del rango visible, con un día de margen a cada lado: los usan
    // tanto los registros como el cardio.
    const desde = new Date(grid[0][0]);
    desde.setDate(desde.getDate() - 1);
    const hasta = new Date(grid[grid.length - 1][6]);
    hasta.setDate(hasta.getDate() + 2);

    // registros de las semanas visibles. Si falla, el error NO se descarta:
    // se avisa en pantalla en vez de pintar todo como "nadie entrenó" (ese
    // bug ya pasó una vez en la versión web).
    //
    // Sin filtro por `logged_by`: desde la v21 esa columna dice quién tecleó
    // el registro, así que filtrarla dejaba en blanco las sesiones que anotó
    // el coach. Como consecuencia RLS deja pasar los registros de los OTROS
    // alumnos del coach; `exBySeries` los descarta abajo, pero igual viajan.
    //
    // Por eso se acota por FECHA y no por lista de series: acotar por
    // `series_id` es el patrón que ya rompió esta pantalla una vez (la lista
    // crece con el plan hasta reventar la URL y la consulta falla en
    // silencio). `logged_at` es un filtro de tamaño fijo — dos bordes — y
    // tiene precedente acá mismo, en la consulta de `cardio_logs`.
    const { data: logs, error: logsErr } = weekNumbers.length
      ? await supabase
          .from('workout_logs')
          .select('series_id, week_number, logged_at')
          .in('week_number', weekNumbers)
          .gte('logged_at', desde.toISOString())
          .lt('logged_at', hasta.toISOString())
      : { data: [], error: null };
    if (logsErr) {
      console.error('calendario: error cargando registros de entrenamiento', logsErr);
      anyQueryError = true;
    }

    // "día real en que se entrenó" -> set de exercise_id con al menos un registro ese día
    const done = new Map<string, Set<string>>();
    (logs ?? []).forEach((l: any) => {
      const exId = exBySeries.get(l.series_id);
      if (!exId || !l.logged_at) return;
      const k = localDateKey(new Date(l.logged_at));
      const set = done.get(k) ?? new Set<string>();
      set.add(exId);
      done.set(k, set);
    });
    setDoneByDay(done);

    // cardio del mismo rango visible
    const { data: cardio, error: cardioError } = await supabase
      .from('cardio_logs')
      .select('id, duration_minutes, logged_at')
      .eq('user_id', client.id)
      .gte('logged_at', desde.toISOString())
      .lt('logged_at', hasta.toISOString());
    if (cardioError) {
      console.error('calendario: error cargando cardio', cardioError);
      anyQueryError = true;
    }

    const cardioMap = new Map<string, number>();
    (cardio ?? []).forEach((c: any) => {
      const k = localDateKey(new Date(c.logged_at));
      cardioMap.set(k, (cardioMap.get(k) ?? 0) + c.duration_minutes);
    });
    setCardioByDay(cardioMap);

    setLogsError(anyQueryError);
  }

  const grid = monthGrid(year, month);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const hoyKey = localDateKey(now);

  function goToMonth(offset: number) {
    const d = new Date(year, month + offset, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  function goToday() {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={16} color={colors.textMuted} />
          <Text style={styles.backText}>ATRÁS</Text>
        </TouchableOpacity>
        <Text style={styles.headerLabel}>CALENDARIO</Text>
        <Text style={styles.headerName}>{client.name.toUpperCase()}</Text>
      </View>

      <View style={styles.monthNav}>
        <TouchableOpacity
          style={styles.monthNavBtn}
          onPress={() => goToMonth(-1)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={16} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.monthNavLabel}>{MESES[month].toUpperCase()} {year}</Text>
        <TouchableOpacity
          style={styles.monthNavBtn}
          onPress={() => goToMonth(1)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-forward" size={16} color={colors.textPrimary} />
        </TouchableOpacity>
        {!isCurrentMonth && (
          <TouchableOpacity style={styles.todayBtn} onPress={goToday}>
            <Text style={styles.todayBtnText}>HOY</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {logsError && (
            <Text style={styles.errorText}>
              No se pudieron cargar todos los datos de este mes (planificación o registros de
              entrenamiento). Por eso el calendario puede verse incompleto — vuelve a intentarlo
              más tarde.
            </Text>
          )}

          {!hasPlan || !hasAnyDay ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>SIN DÍAS PLANIFICADOS</Text>
              <Text style={styles.emptyText}>
                Este alumno todavía no tiene días de entrenamiento planificados.
              </Text>
            </Card>
          ) : (
            <>
              <View style={styles.gridHeaderRow}>
                {CABECERA.map(c => (
                  <Text key={c} style={styles.gridHeaderCell}>{c}</Text>
                ))}
              </View>

              {grid.map((row, ri) => (
                <View key={ri} style={styles.gridRow}>
                  {row.map(date => (
                    <CalendarCell
                      key={localDateKey(date)}
                      date={date}
                      month={month}
                      hoyKey={hoyKey}
                      trainingDays={trainingDays}
                      planWeeks={planWeeks}
                      doneByDay={doneByDay}
                      cardioByDay={cardioByDay}
                      logsError={logsError}
                    />
                  ))}
                </View>
              ))}

              <View style={styles.legend}>
                <Text style={styles.legendItem}>■ relleno = día completo</Text>
                <Text style={styles.legendItem}>▭ borde punteado ámbar = día planificado que no se registró</Text>
                <Text style={styles.legendItem}>■ relleno tenue "fuera de lo planificado" = se entrenó ese día, pero era otro el planificado</Text>
                <Text style={styles.legendItem}>"movido al …" = el día planificado se cumplió en otro día de la misma semana</Text>
                <Text style={styles.legendItem}>⏱ = cardio registrado ese día</Text>
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ── Celda del calendario ─────────────────────────────────────────────────

interface CellProps {
  date: Date;
  month: number;
  hoyKey: string;
  trainingDays: DayRow[];
  planWeeks: PlanWeek[];
  doneByDay: Map<string, Set<string>>;
  cardioByDay: Map<string, number>;
  logsError: boolean;
}

function CalendarCell({
  date, month, hoyKey, trainingDays, planWeeks, doneByDay, cardioByDay, logsError,
}: CellProps) {
  const key = localDateKey(date);
  const esDelMes = date.getMonth() === month;
  const esHoy = key === hoyKey;
  const esPasado = key < hoyKey; // HOY nunca es pasado

  const weekNum = calendarWeekNumberForDate(date);
  const activeWeek = weekNum != null ? resolveActiveWeek(planWeeks, weekNum) : null;

  // todos los días planificados de la semana de programa de esta celda (no
  // solo los que caen hoy) — hace falta para detectar sesiones hechas fuera
  // de su día
  const allDaysThisWeek = activeWeek ? trainingDays.filter(d => d.plan_week_id === activeWeek.id) : [];
  const delDia = allDaysThisWeek.filter(d => d.week_day === date.getDay());
  const done = doneByDay.get(key) ?? new Set<string>();
  const offScheduleAqui = allDaysThisWeek.filter(d =>
    d.week_day !== date.getDay() && d.exerciseIds.some(id => done.has(id)));

  const weekDayPairs = weekNum != null
    ? weekDates(weekNum).map(d => ({ key: localDateKey(d), date: d }))
    : [];
  const weekDayKeysForWeek = weekDayPairs.map(p => p.key);
  const cardioMin = cardioByDay.get(key) ?? 0;

  return (
    <View style={[
      styles.cell,
      esHoy && styles.cellToday,
      !esDelMes && styles.cellOutside,
    ]}>
      <View style={styles.cellHeadRow}>
        <Text style={[styles.cellDayNum, esHoy && styles.cellDayNumToday]}>{date.getDate()}</Text>
        {activeWeek && esDelMes && <Text style={styles.cellWeekBadge}>S{weekNum}</Text>}
      </View>

      {delDia.map(d => {
        const total = d.exerciseIds.length;
        const hechos = d.exerciseIds.filter(id => done.has(id)).length;
        const estado: EstadoCelda = estadoDeCelda({
          planificadosHoy: [d],
          fueraDeLoPlanificado: [],
          hechosPorDia: doneByDay,
          claveDeEstaCelda: key,
          clavesDeLaSemana: weekDayKeysForWeek,
          esPasado,
          huboErrorDeConsulta: logsError,
        });
        if (estado === 'vacio') return null;

        const movidoA = estado === 'movido'
          ? offScheduleDayKeys(d.exerciseIds, weekDayKeysForWeek, key, doneByDay)[0]
          : undefined;
        const movidoFecha = movidoA ? weekDayPairs.find(p => p.key === movidoA)?.date : undefined;

        return (
          <View
            key={d.id}
            style={[
              styles.sessionBlock,
              estado === 'completo' && styles.sessionCompleto,
              estado === 'perdido' && styles.sessionPerdido,
            ]}
          >
            <Text
              style={[styles.sessionName, estado === 'completo' && styles.sessionNameCompleto]}
              numberOfLines={1}
            >
              {d.name}
            </Text>
            {total > 0 && (
              <Text style={[
                styles.sessionMeta,
                estado === 'completo' && styles.sessionMetaCompleto,
                estado === 'parcial' && styles.sessionMetaParcial,
                estado === 'movido' && styles.sessionMetaMovido,
              ]}>
                {estado === 'movido' && movidoFecha
                  ? `movido al ${shortWeekday(movidoFecha)}`
                  : estado === 'pendiente' ? 'pendiente' : `${hechos}/${total}`}
              </Text>
            )}
          </View>
        );
      })}

      {offScheduleAqui.map(d => {
        const totalAqui = d.exerciseIds.length;
        const hechosAqui = d.exerciseIds.filter(id => done.has(id)).length;
        return (
          <View key={`off-${d.id}`} style={[styles.sessionBlock, styles.sessionFuera]}>
            <Text style={styles.sessionNameFuera} numberOfLines={1}>{d.name}</Text>
            <Text style={styles.sessionMetaFuera}>
              ✓ fuera de lo planificado ({hechosAqui}/{totalAqui})
            </Text>
          </View>
        );
      })}

      {cardioMin > 0 && <Text style={styles.cardioTag}>⏱ {cardioMin} min</Text>}
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

  monthNav: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.xl, marginBottom: spacing.md,
  },
  monthNavBtn: {
    width: 30, height: 30, borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  monthNavLabel: { ...typography.label, letterSpacing: 1.5, fontSize: 11 },
  todayBtn: {
    marginLeft: 'auto', borderWidth: 1, borderColor: colors.accent, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  todayBtnText: { fontSize: 9, fontWeight: '900', letterSpacing: 1, color: colors.accent },

  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  errorText: { ...typography.caption, marginBottom: spacing.md },

  emptyCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyTitle: { ...typography.h3, color: colors.textMuted },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },

  gridHeaderRow: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  gridHeaderCell: {
    flex: 1, textAlign: 'center', fontSize: 9, fontWeight: '800',
    letterSpacing: 1, color: colors.textMuted,
  },
  gridRow: { flexDirection: 'row', gap: 4, marginBottom: 4 },

  cell: {
    flex: 1, minHeight: 74, borderRadius: radius.sm, padding: 4, gap: 3,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  cellToday: { borderColor: colors.accent },
  cellOutside: { opacity: 0.35, backgroundColor: 'transparent' },
  cellHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cellDayNum: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  cellDayNumToday: { fontWeight: '900', color: colors.accent },
  cellWeekBadge: { fontSize: 7.5, color: colors.textMuted },

  sessionBlock: {
    borderRadius: 5, paddingHorizontal: 4, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.border,
  },
  sessionName: { fontSize: 8.5, fontWeight: '700', color: colors.textPrimary, lineHeight: 11 },
  sessionMeta: { fontFamily: fonts.mono, fontSize: 7.5, color: colors.textMuted, marginTop: 1 },

  sessionCompleto: { backgroundColor: colors.accent, borderColor: colors.accent },
  sessionNameCompleto: { color: colors.background },
  sessionMetaCompleto: { color: colors.background },
  sessionMetaParcial: { color: colors.accent },
  sessionMetaMovido: { color: colors.textSecondary },

  sessionPerdido: { borderColor: colors.warning, borderStyle: 'dashed', borderWidth: 2 },

  sessionFuera: { backgroundColor: colors.accent, borderColor: colors.accent, opacity: 0.7 },
  sessionNameFuera: { fontSize: 8.5, fontWeight: '700', color: colors.background, lineHeight: 11 },
  sessionMetaFuera: { fontFamily: fonts.mono, fontSize: 7.5, color: colors.background, marginTop: 1 },

  cardioTag: { fontFamily: fonts.mono, fontSize: 7.5, color: colors.accent, marginTop: 1 },

  legend: { marginTop: spacing.lg, gap: 6 },
  legendItem: { ...typography.caption, fontSize: 10.5 },
});
