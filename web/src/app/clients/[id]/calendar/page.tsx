import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import Logo from '@/components/Logo';
import type { AppUser } from '@/lib/types';
import { resolveActiveWeek, type PlanWeek } from '@/lib/planWeeks';
import { weekNumberForDate, monthGrid } from '@/lib/weeks';

export const dynamic = 'force-dynamic';

// Calendario mensual de UN alumno: qué entrenamiento tocaba cada día según el
// plan, y si lo cumplió. Solo lectura — editar se sigue haciendo en
// "Gestión de semanas" dentro del plan.

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const CABECERA = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

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

  // mes a mostrar: ?m=YYYY-MM, por defecto el mes actual
  const hoy = new Date();
  const match = /^(\d{4})-(\d{2})$/.exec(m ?? '');
  const year = match ? Number(match[1]) : hoy.getFullYear();
  const month = match ? Number(match[2]) - 1 : hoy.getMonth();
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

  const { data: daysData } = plan
    ? await supabase
        .from('training_days')
        .select(`
          id, name, week_day, archived, plan_week_id,
          exercises ( id, name, archived, exercise_series ( id ) )
        `)
        .eq('plan_id', plan.id)
    : { data: null };

  const trainingDays = (daysData ?? [])
    .filter((d: any) => !d.archived && !d.name.toLowerCase().includes('libre'))
    .map((d: any) => ({
      ...d,
      exercises: (d.exercises ?? []).filter((e: any) => !e.archived),
    }));

  // logs de todas las semanas que toca este mes, en una sola consulta
  const weekNumbers = Array.from(new Set(grid.flat().map((d) => weekNumberForDate(d))));
  const allSeriesIds = trainingDays.flatMap((d: any) =>
    d.exercises.flatMap((e: any) => (e.exercise_series ?? []).map((s: any) => s.id)));

  const { data: logs } = allSeriesIds.length
    ? await supabase
        .from('workout_logs')
        .select('series_id, week_number')
        .in('series_id', allSeriesIds)
        .in('week_number', weekNumbers)
    : { data: null };

  // series_id -> exercise_id, para contar ejercicios completados (no series)
  const exBySeries = new Map<string, string>();
  trainingDays.forEach((d: any) => d.exercises.forEach((e: any) =>
    (e.exercise_series ?? []).forEach((s: any) => exBySeries.set(s.id, e.id))));

  // "semana N" -> set de exercise_id con al menos un registro
  const doneByWeek = new Map<number, Set<string>>();
  (logs ?? []).forEach((l: any) => {
    const exId = exBySeries.get(l.series_id);
    if (!exId) return;
    const set = doneByWeek.get(l.week_number) ?? new Set<string>();
    set.add(exId);
    doneByWeek.set(l.week_number, set);
  });

  // cardio del rango visible
  const desde = grid[0][0];
  const hasta = new Date(grid[grid.length - 1][6]);
  hasta.setDate(hasta.getDate() + 1);
  const { data: cardio } = await supabase
    .from('cardio_logs')
    .select('id, type, duration_minutes, logged_at')
    .eq('user_id', id)
    .gte('logged_at', desde.toISOString())
    .lt('logged_at', hasta.toISOString());

  const cardioByDay = new Map<string, number>();
  (cardio ?? []).forEach((c: any) => {
    const k = new Date(c.logged_at).toDateString();
    cardioByDay.set(k, (cardioByDay.get(k) ?? 0) + c.duration_minutes);
  });

  const esHoy = (d: Date) => d.toDateString() === hoy.toDateString();
  const esDelMes = (d: Date) => d.getMonth() === month;

  return (
    <>
      <header className="app-header">
        <div className="container inner">
          <Link href="/dashboard" className="brand"><Logo /></Link>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href={`/clients/${id}/week`} className="btn btn-ghost" style={{ padding: '10px 18px' }}>
              SEMANA A SEMANA
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

        {!plan || trainingDays.length === 0 ? (
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
                    const weekNum = weekNumberForDate(date);
                    const activeWeek = resolveActiveWeek(planWeeks, weekNum);
                    const delDia = activeWeek
                      ? trainingDays.filter((d: any) =>
                          d.plan_week_id === activeWeek.id && d.week_day === date.getDay())
                      : [];
                    const done = doneByWeek.get(weekNum) ?? new Set<string>();
                    const cardioMin = cardioByDay.get(date.toDateString()) ?? 0;
                    const futuro = date.getTime() > hoy.getTime() && !esHoy(date);

                    return (
                      <div
                        key={date.toISOString()}
                        style={{
                          minHeight: 96,
                          borderRadius: 8,
                          border: `1px solid ${esHoy(date) ? 'var(--accent)' : 'var(--border)'}`,
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
                            fontWeight: esHoy(date) ? 900 : 600,
                            color: esHoy(date) ? 'var(--accent)' : 'var(--text-secondary)',
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
                          const parcial = hechos > 0 && !completo;
                          const perdido = hechos === 0 && !futuro;
                          return (
                            <Link
                              key={d.id}
                              href={`/clients/${id}/week?week=${weekNum}`}
                              title={`${d.name} — ${hechos}/${total} ejercicios`}
                              style={{
                                display: 'block', textDecoration: 'none',
                                borderRadius: 5, padding: '3px 5px',
                                background: completo ? 'var(--accent)' : 'transparent',
                                border: `1px solid ${completo ? 'var(--accent)' : perdido ? 'var(--danger)' : 'var(--border)'}`,
                                color: completo ? 'var(--bg)' : 'var(--text)',
                              }}
                            >
                              <div style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.25 }}>
                                {d.name}
                              </div>
                              <div style={{
                                fontSize: 9,
                                fontFamily: 'var(--font-mono)',
                                opacity: 0.85,
                                color: completo ? 'var(--bg)' : parcial ? 'var(--accent)' : undefined,
                              }}>
                                {futuro && hechos === 0 ? 'pendiente' : `${hechos}/${total}`}
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
          <span style={{ fontSize: 11 }}>□ borde rojo = día planificado que no registró</span>
          <span style={{ fontSize: 11 }}>⏱ = cardio registrado ese día</span>
          <span style={{ fontSize: 11 }}>Toca un día para ver el detalle de esa semana.</span>
        </div>
      </main>
    </>
  );
}
