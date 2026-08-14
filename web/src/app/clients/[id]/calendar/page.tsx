import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import Logo from '@/components/Logo';
import type { AppUser } from '@/lib/types';
import { resolveActiveWeek, type PlanWeek } from '@/lib/planWeeks';
import {
  calendarWeekNumberForDate, monthGrid, santiagoDayKey,
  weekDates, localDateKey, offScheduleDayKeys, WEEK_DAYS_SHORT,
} from '@/lib/weeks';

export const dynamic = 'force-dynamic';

// Calendario mensual de UN alumno: qué entrenamiento tocaba cada día según el
// plan, y si lo cumplió. Solo lectura — editar se sigue haciendo en
// "Gestión de semanas" dentro del plan.
//
// Los alumnos entrenan en Chile pero el servidor (Vercel) corre en UTC, así
// que "qué día es" para armar el calendario y agrupar cardio/registros se
// calcula SIEMPRE en hora de Santiago (ver santiagoDayKey en lib/weeks.ts) —
// nunca con getDate()/toDateString() sobre un timestamp real.

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const CABECERA = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

// Clave "YYYY-MM-DD" de una celda de la grilla (misma función que usan las
// demás fechas locales del calendario — ver localDateKey en lib/weeks.ts).
const cellKey = localDateKey;

/** "mié 12": día corto + número, para la nota "movido al ..." */
function shortWeekday(d: Date): string {
  return `${WEEK_DAYS_SHORT[d.getDay()].toLowerCase()} ${d.getDate()}`;
}

export default async function ClientCalendarPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ m?: string }> }) {
  const { id } = await params;
  const { m } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== 'coach') redirect('/login');

  const { data: client } = await supabase
    .from('users').select('id, name, coach_id').eq('id', id).maybeSingle();
  if (!client || (client as AppUser).coach_id !== user.id) notFound();

  // "hoy" según el alumno (Chile), no según el servidor (UTC)
  const hoyKey = santiagoDayKey(new Date());
  const [hoyYear, hoyMonth] = hoyKey.split('-').map(Number);

  // mes a mostrar: ?m=YYYY-MM, por defecto el mes actual. Un mes fuera de
  // 1-12 (o cualquier otro formato inválido) cae al mes actual en vez de
  // romper la página.
  const match = /^(\d{4})-(\d{2})$/.exec(m ?? '');
  let year = hoyYear;
  let month = hoyMonth - 1;
  if (match) {
    const mm = Number(match[2]);
    if (mm >= 1 && mm <= 12) {
      year = Number(match[1]);
      month = mm - 1;
    }
  }
  const grid = monthGrid(year, month);

  const prevDate = new Date(year, month - 1, 1);
  const nextDate = new Date(year, month + 1, 1);
  const asParam = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  const { data: plan } = await supabase
    .from('workout_plans').select('id').eq('client_id', id).maybeSingle();

  const { data: weeksData } = plan
    ? await supabase.from('plan_weeks').select('*').eq('plan_id', plan.id).eq('archived', false)
    : { data: null };
  const planWeeks = (weeksData ?? []) as PlanWeek[];

  // semana de programa (o null si es antes del epoch) de cada día visible,
  // y qué plan_week corresponde a cada una — se resuelve ANTES de pedir los
  // días de entrenamiento para no traer más que las semanas que se ven acá.
  const weekNumByCell = new Map<string, number | null>();
  grid.flat().forEach((d) => weekNumByCell.set(cellKey(d), calendarWeekNumberForDate(d)));
  const weekNumbers = Array.from(new Set(
    Array.from(weekNumByCell.values()).filter((w): w is number => w != null),
  ));
  const activeWeekByWeekNum = new Map<number, PlanWeek | null>();
  weekNumbers.forEach((w) => activeWeekByWeekNum.set(w, resolveActiveWeek(planWeeks, w)));
  const visiblePlanWeekIds = Array.from(new Set(
    Array.from(activeWeekByWeekNum.values()).filter((w): w is PlanWeek => w != null).map((w) => w.id),
  ));

  const { data: daysData } = visiblePlanWeekIds.length
    ? await supabase
        .from('training_days')
        .select(`
          id, name, week_day, archived, plan_week_id,
          exercises ( id, name, archived, exercise_series ( id ) )
        `)
        .in('plan_week_id', visiblePlanWeekIds)
    : { data: null };

  const trainingDays = (daysData ?? [])
    .filter((d: any) => !d.archived && !d.name.toLowerCase().includes('libre'))
    .map((d: any) => ({
      ...d,
      exercises: (d.exercises ?? []).filter((e: any) => !e.archived),
    }));

  // si el plan tiene días planificados en OTRAS semanas (fuera del mes que se
  // está mirando), igual hay que dibujar la grilla — solo viene vacía este
  // mes. Consulta liviana (1 fila), independiente de la de arriba para no
  // reintroducir el problema de la lista sin límite (finding I4).
  const { data: anyDay } = plan
    ? await supabase.from('training_days').select('id').eq('plan_id', plan.id).limit(1).maybeSingle()
    : { data: null };

  const allSeriesIds = trainingDays.flatMap((d: any) =>
    d.exercises.flatMap((e: any) => (e.exercise_series ?? []).map((s: any) => s.id)));

  const { data: logs, error: logsError } = allSeriesIds.length
    ? await supabase
        .from('workout_logs')
        .select('series_id, week_number, logged_at')
        .in('series_id', allSeriesIds)
        .in('week_number', weekNumbers)
    : { data: null, error: null };
  if (logsError) console.error('calendar: error cargando workout_logs', logsError);

  // series_id -> exercise_id, para contar ejercicios completados (no series)
  const exBySeries = new Map<string, string>();
  trainingDays.forEach((d: any) => d.exercises.forEach((e: any) =>
    (e.exercise_series ?? []).forEach((s: any) => exBySeries.set(s.id, e.id))));

  // "día real en que se entrenó" (no el día planificado) -> set de
  // exercise_id con al menos un registro ese día, en hora de Chile.
  const doneByDay = new Map<string, Set<string>>();
  (logs ?? []).forEach((l: any) => {
    const exId = exBySeries.get(l.series_id);
    if (!exId || !l.logged_at) return;
    const k = santiagoDayKey(new Date(l.logged_at));
    const set = doneByDay.get(k) ?? new Set<string>();
    set.add(exId);
    doneByDay.set(k, set);
  });

  // cardio del rango visible, con un día de margen a cada lado para no
  // perder sesiones cercanas al borde del mes por el desfase horario
  const desde = new Date(grid[0][0]);
  desde.setDate(desde.getDate() - 1);
  const hasta = new Date(grid[grid.length - 1][6]);
  hasta.setDate(hasta.getDate() + 2);
  const { data: cardio } = await supabase
    .from('cardio_logs')
    .select('id, type, duration_minutes, logged_at')
    .eq('user_id', id)
    .gte('logged_at', desde.toISOString())
    .lt('logged_at', hasta.toISOString());

  const cardioByDay = new Map<string, number>();
  (cardio ?? []).forEach((c: any) => {
    const k = santiagoDayKey(new Date(c.logged_at));
    cardioByDay.set(k, (cardioByDay.get(k) ?? 0) + c.duration_minutes);
  });

  const esHoy = (d: Date) => cellKey(d) === hoyKey;
  const esFuturo = (d: Date) => cellKey(d) > hoyKey;
  const esPasado = (d: Date) => cellKey(d) < hoyKey;
  const esDelMes = (d: Date) => d.getMonth() === month;

  return (
    <>
      <header className="app-header">
        <div className="container inner">
          <Link href="/dashboard" className="brand"><Logo /></Link>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href={`/clients/${id}/week`} className="btn btn-ghost" style={{ padding: '10px 18px' }}>
              ESTA SEMANA
            </Link>
            <Link href={`/clients/${id}`} className="btn btn-ghost" style={{ padding: '10px 18px' }}>
              ← PLAN
            </Link>
          </div>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 34, paddingBottom: 60 }}>
        <span className="label accent">Calendario</span>
        <h1 className="display" style={{ fontSize: 40 }}>{(client as AppUser).name}</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <Link href={`/clients/${id}/calendar?m=${asParam(prevDate)}`} className="btn btn-ghost" style={{ padding: '8px 14px' }}>
            ← {MESES[prevDate.getMonth()].toUpperCase()}
          </Link>
          <strong style={{ fontSize: 14 }}>{MESES[month].toUpperCase()} {year}</strong>
          <Link href={`/clients/${id}/calendar?m=${asParam(nextDate)}`} className="btn btn-ghost" style={{ padding: '8px 14px' }}>
            {MESES[nextDate.getMonth()].toUpperCase()} →
          </Link>
          <Link href={`/clients/${id}/calendar`} className="btn btn-ghost" style={{ padding: '8px 14px' }}>HOY</Link>
        </div>

        {logsError && (
          <p style={{ marginTop: 16, color: 'var(--text-secondary)', fontSize: 13 }}>
            No se pudieron cargar los registros de entrenamiento de este mes. Por eso ningún día se
            marca como no registrado por ahora — recarga la página para reintentar.
          </p>
        )}

        {!plan || !anyDay ? (
          <p className="muted" style={{ marginTop: 30 }}>
            Este alumno todavía no tiene días de entrenamiento planificados.
          </p>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: 20 }}>
            <div style={{ minWidth: 720 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
                {CABECERA.map((c) => (
                  <div key={c} className="label muted" style={{ fontSize: 9, letterSpacing: 1, textAlign: 'center' }}>
                    {c}
                  </div>
                ))}
              </div>

              {grid.map((row, ri) => (
                <div key={ri} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
                  {row.map((date) => {
                    const key = cellKey(date);
                    const weekNum = weekNumByCell.get(key) ?? null;
                    const activeWeek = weekNum != null ? (activeWeekByWeekNum.get(weekNum) ?? null) : null;
                    // todos los días planificados de la semana de programa de esta celda
                    // (no solo los que caen hoy) — hace falta para detectar sesiones
                    // hechas fuera de su día
                    const allDaysThisWeek = activeWeek
                      ? trainingDays.filter((d: any) => d.plan_week_id === activeWeek.id)
                      : [];
                    const delDia = allDaysThisWeek.filter((d: any) => d.week_day === date.getDay());
                    const done = doneByDay.get(key) ?? new Set<string>();
                    // sesiones de OTRO día de esta misma semana cuyos ejercicios se
                    // registraron hoy — se dibujan como "hecho fuera de lo planificado"
                    const offScheduleAqui = allDaysThisWeek.filter((d: any) =>
                      d.week_day !== date.getDay() && d.exercises.some((e: any) => done.has(e.id)));
                    // las 7 fechas de la semana de programa de esta celda, para saber si
                    // un día planificado sin registro HOY se entrenó en otro día de la
                    // misma semana ("movido") en vez de contarlo como perdido
                    const weekDayPairs = weekNum != null
                      ? weekDates(weekNum).map((d) => ({ key: cellKey(d), date: d }))
                      : [];
                    const weekDayKeysForWeek = weekDayPairs.map((p) => p.key);
                    const cardioMin = cardioByDay.get(key) ?? 0;
                    const futuro = esFuturo(date);
                    const hoyCelda = esHoy(date);
                    const pasado = esPasado(date);

                    return (
                      <div
                        key={key}
                        style={{
                          minHeight: 96,
                          borderRadius: 8,
                          border: `1px solid ${hoyCelda ? 'var(--accent)' : 'var(--border)'}`,
                          background: esDelMes(date) ? 'var(--surface)' : 'transparent',
                          opacity: esDelMes(date) ? 1 : 0.4,
                          padding: 6,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{
                            fontSize: 12,
                            fontWeight: hoyCelda ? 900 : 600,
                            color: hoyCelda ? 'var(--accent)' : 'var(--text-secondary)',
                          }}>
                            {date.getDate()}
                          </span>
                          {activeWeek && esDelMes(date) && (
                            <span className="muted" style={{ fontSize: 8.5 }}>S{weekNum}</span>
                          )}
                        </div>

                        {delDia.map((d: any) => {
                          const hechos = d.exercises.filter((e: any) => done.has(e.id)).length;
                          const total = d.exercises.length;
                          const completo = total > 0 && hechos >= total;
                          const parcial = total > 0 && hechos > 0 && !completo;
                          // si no hay nada registrado ESTE día, antes de darlo por perdido
                          // hay que revisar si se entrenó en otro día de la misma semana
                          const movidoA = (total > 0 && hechos === 0)
                            ? offScheduleDayKeys(
                                d.exercises.map((e: any) => e.id),
                                weekDayKeysForWeek,
                                key,
                                doneByDay,
                              )[0]
                            : undefined;
                          const movidoFecha = movidoA
                            ? weekDayPairs.find((p) => p.key === movidoA)?.date
                            : undefined;
                          const movido = movidoFecha != null;
                          // solo cuenta como no registrado un día que ya pasó Y que tampoco
                          // se movió a otro día de la semana — hoy todavía está pendiente,
                          // no perdido, y un día sin ejercicios vigentes (todos archivados)
                          // tampoco tiene nada que mostrar
                          const perdido = total > 0 && !logsError && hechos === 0 && pasado && !movido;
                          return (
                            <Link
                              key={d.id}
                              href={`/clients/${id}/week?week=${weekNum}`}
                              title={movido
                                ? `${d.name} — se entrenó el ${shortWeekday(movidoFecha!)}`
                                : `${d.name} — ${hechos}/${total} ejercicios`}
                              style={{
                                display: 'block', textDecoration: 'none',
                                borderRadius: 5, padding: '3px 5px',
                                background: completo ? 'var(--accent)' : 'transparent',
                                border: perdido
                                  ? '2px dashed var(--text-secondary)'
                                  : `1px solid ${completo ? 'var(--accent)' : 'var(--border)'}`,
                                color: completo ? 'var(--bg)' : 'var(--text)',
                              }}
                            >
                              <div style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.25 }}>
                                {d.name}
                              </div>
                              {total > 0 && (
                                <div style={{
                                  fontSize: 9,
                                  fontFamily: 'var(--font-mono)',
                                  opacity: 0.85,
                                  color: completo ? 'var(--bg)' : parcial ? 'var(--accent)' : movido ? 'var(--text-secondary)' : undefined,
                                }}>
                                  {movido
                                    ? `movido al ${shortWeekday(movidoFecha!)}`
                                    : (futuro || hoyCelda) && hechos === 0 ? 'pendiente' : `${hechos}/${total}`}
                                </div>
                              )}
                            </Link>
                          );
                        })}

                        {offScheduleAqui.map((d: any) => {
                          const hechosAqui = d.exercises.filter((e: any) => done.has(e.id)).length;
                          const total = d.exercises.length;
                          return (
                            <Link
                              key={`off-${d.id}`}
                              href={`/clients/${id}/week?week=${weekNum}`}
                              title={`${d.name} — hecho fuera de lo planificado (${hechosAqui}/${total} ejercicios)`}
                              style={{
                                display: 'block', textDecoration: 'none',
                                borderRadius: 5, padding: '3px 5px',
                                background: 'var(--accent)',
                                border: '1px solid var(--accent)',
                                color: 'var(--bg)',
                                opacity: 0.7,
                              }}
                            >
                              <div style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.25 }}>
                                {d.name}
                              </div>
                              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)' }}>
                                ✓ fuera de lo planificado
                              </div>
                            </Link>
                          );
                        })}

                        {cardioMin > 0 && (
                          <div style={{ fontSize: 9, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                            ⏱ {cardioMin} min
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }} className="muted">
          <span style={{ fontSize: 11 }}>■ relleno = día completo</span>
          <span style={{ fontSize: 11 }}>▭ borde punteado = día planificado que no registró</span>
          <span style={{ fontSize: 11 }}>■ relleno tenue “✓ fuera de lo planificado” = se entrenó ese día, pero era otro el día planificado</span>
          <span style={{ fontSize: 11 }}>“movido al …” = el día planificado se cumplió en otro día de la misma semana</span>
          <span style={{ fontSize: 11 }}>⏱ = cardio registrado ese día</span>
          <span style={{ fontSize: 11 }}>Toca un día para ver el detalle de esa semana.</span>
        </div>
      </main>
    </>
  );
}
