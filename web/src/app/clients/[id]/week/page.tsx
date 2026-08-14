import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import Logo from '@/components/Logo';
import type { AppUser } from '@/lib/types';
import { resolveActiveWeek, type PlanWeek } from '@/lib/planWeeks';
import { santiagoCurrentWeek, WEEK_DAYS_SHORT, formatShortDate } from '@/lib/weeks';

export const dynamic = 'force-dynamic';

// Vista semanal del coach: qué hizo REALMENTE el alumno cada día de una
// semana (peso y reps serie por serie), navegable hacia atrás y adelante
// igual que la app. Espejo de ClientWeekScreen.tsx en trainer-app.

export default async function ClientWeekPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ week?: string }> }) {
  const { id } = await params;
  const { week: weekParam } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== 'coach') redirect('/login');

  const { data: client } = await supabase
    .from('users').select('id, name, coach_id').eq('id', id).maybeSingle();
  if (!client || (client as AppUser).coach_id !== user.id) notFound();

  const currentWeek = santiagoCurrentWeek();
  const week = Math.max(1, parseInt(weekParam ?? '', 10) || currentWeek);

  const { data: plan } = await supabase
    .from('workout_plans').select('id').eq('client_id', id).maybeSingle();

  const { data: weeksData } = plan
    ? await supabase.from('plan_weeks').select('*').eq('plan_id', plan.id).eq('archived', false)
    : { data: null };
  const activeWeek = resolveActiveWeek((weeksData ?? []) as PlanWeek[], week);

  const { data: daysData } = activeWeek
    ? await supabase
        .from('training_days')
        .select(`
          id, day_number, name, week_day, archived,
          exercises ( id, name, unit, order_index, archived,
            exercise_series ( id, series_number ) )
        `)
        .eq('plan_week_id', activeWeek.id)
    : { data: null };

  const days = (daysData ?? [])
    .filter((d: any) => !d.archived && !d.name.toLowerCase().includes('libre'))
    .map((d: any) => ({
      ...d,
      exercises: (d.exercises ?? [])
        .filter((e: any) => !e.archived)
        .sort((a: any, b: any) => a.order_index - b.order_index),
    }))
    .sort((a: any, b: any) => a.day_number - b.day_number);

  // logs de esa semana
  const seriesIds = days.flatMap((d: any) =>
    d.exercises.flatMap((e: any) => (e.exercise_series ?? []).map((s: any) => s.id)));
  const { data: logs } = seriesIds.length
    ? await supabase.from('workout_logs')
        .select('series_id, weight, reps, rir, logged_at')
        .in('series_id', seriesIds).eq('week_number', week)
    : { data: null };

  const seriesMeta = new Map<string, { exId: string; dayId: string; num: number; unit: string }>();
  days.forEach((d: any) => d.exercises.forEach((e: any) =>
    (e.exercise_series ?? []).forEach((s: any) =>
      seriesMeta.set(s.id, { exId: e.id, dayId: d.id, num: s.series_number, unit: e.unit }))));

  const setsByEx = new Map<string, { num: number; weight: number; reps: number; rir: number | null; unit: string }[]>();
  const dateByDay = new Map<string, string>();
  (logs ?? []).forEach((l: any) => {
    const meta = seriesMeta.get(l.series_id);
    if (!meta) return;
    const arr = setsByEx.get(meta.exId) ?? [];
    arr.push({ num: meta.num, weight: l.weight, reps: l.reps, rir: l.rir, unit: meta.unit });
    setsByEx.set(meta.exId, arr);
    const prev = dateByDay.get(meta.dayId);
    if (l.logged_at && (!prev || l.logged_at < prev)) dateByDay.set(meta.dayId, l.logged_at);
  });
  setsByEx.forEach((arr) => arr.sort((a, b) => a.num - b.num));

  // cardio de esa semana calendario (lun–dom)
  const monday = new Date(Date.now() - (currentWeek - week) * 7 * 86400000);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday.getTime() + 7 * 86400000);
  const { data: cardio } = await supabase
    .from('cardio_logs').select('id, type, duration_minutes, logged_at')
    .eq('user_id', id)
    .gte('logged_at', monday.toISOString()).lt('logged_at', sunday.toISOString())
    .order('logged_at');

  const totalVolume = Array.from(setsByEx.values()).flat().reduce((a, s) => a + s.weight * s.reps, 0);
  const totalExercises = days.reduce((a: number, d: any) => a + d.exercises.length, 0);
  const cardioMin = (cardio ?? []).reduce((a, c) => a + c.duration_minutes, 0);

  return (
    <>
      <header className="app-header">
        <div className="container inner">
          <Link href="/dashboard" className="brand"><Logo /></Link>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href={`/clients/${id}/calendar`} className="btn btn-ghost" style={{ padding: '10px 18px' }}>CALENDARIO</Link>
            <Link href={`/clients/${id}/progress`} className="btn btn-ghost" style={{ padding: '10px 18px' }}>POR EJERCICIO</Link>
            <Link href={`/clients/${id}`} className="btn btn-ghost" style={{ padding: '10px 18px' }}>← PLAN</Link>
          </div>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 34, paddingBottom: 60, maxWidth: 900 }}>
        <span className="label accent">Progreso semanal</span>
        <h1 className="display" style={{ fontSize: 40 }}>{(client as AppUser).name}</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <Link
            href={`/clients/${id}/week?week=${Math.max(1, week - 1)}`}
            className="btn btn-ghost"
            style={{ padding: '8px 14px', pointerEvents: week <= 1 ? 'none' : undefined, opacity: week <= 1 ? 0.4 : 1 }}
          >
            ← ANTERIOR
          </Link>
          <strong style={{ fontSize: 14 }}>
            SEMANA {week}{week === currentWeek ? ' · ACTUAL' : week < currentWeek ? ' · PASADA' : ' · FUTURA'}
          </strong>
          <Link href={`/clients/${id}/week?week=${week + 1}`} className="btn btn-ghost" style={{ padding: '8px 14px' }}>
            SIGUIENTE →
          </Link>
          {week !== currentWeek && (
            <Link href={`/clients/${id}/week`} className="btn btn-ghost" style={{ padding: '8px 14px' }}>HOY</Link>
          )}
        </div>

        {!activeWeek || days.length === 0 ? (
          <p className="muted" style={{ marginTop: 30 }}>
            No hay una semana planificada para la semana {week}. Créala desde &quot;Gestión de semanas&quot; en el plan.
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
              {[
                { v: `${setsByEx.size}/${totalExercises}`, l: 'EJERCICIOS REGISTRADOS' },
                { v: Math.round(totalVolume).toLocaleString('es-CL'), l: 'KG TOTALES' },
                { v: String(cardioMin), l: 'MIN CARDIO' },
              ].map((s) => (
                <div key={s.l} className="editor-day" style={{ flex: 1, minWidth: 150, textAlign: 'center', padding: 16 }}>
                  <div className="display" style={{ fontSize: 26, color: 'var(--accent)' }}>{s.v}</div>
                  <div className="label muted" style={{ fontSize: 9, letterSpacing: 1 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {days.map((day: any) => {
              const doneInDay = day.exercises.filter((e: any) => setsByEx.has(e.id)).length;
              const trained = doneInDay > 0;
              const trainedDate = dateByDay.get(day.id);
              return (
                <div key={day.id} className="editor-day" style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                    <span style={{
                      background: trained ? 'var(--accent)' : 'var(--surface)',
                      color: trained ? 'var(--bg)' : 'var(--text-secondary)',
                      border: '1px solid var(--border)', borderRadius: 6,
                      padding: '3px 8px', fontSize: 11, fontWeight: 800, letterSpacing: 1,
                    }}>
                      {day.week_day != null ? WEEK_DAYS_SHORT[day.week_day].toUpperCase() : `D${day.day_number}`}
                    </span>
                    <h3 style={{ fontSize: 15, margin: 0 }}>{day.name.toUpperCase()}</h3>
                    <span className="muted" style={{ fontSize: 12, marginLeft: 'auto' }}>
                      {trained
                        ? `${doneInDay}/${day.exercises.length} ejercicios${trainedDate ? ` · ${formatShortDate(trainedDate)}` : ''}`
                        : 'Sin registrar'}
                    </span>
                  </div>

                  {day.exercises.map((ex: any) => {
                    const sets = setsByEx.get(ex.id);
                    return (
                      <div key={ex.id} style={{ borderTop: '1px solid var(--border)', padding: '10px 0' }}>
                        <Link
                          href={`/clients/${id}/exercise/${ex.id}`}
                          style={{
                            fontSize: 13,
                            fontWeight: sets ? 700 : 400,
                            color: sets ? 'var(--text)' : 'var(--text-secondary)',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                          title={`Ver historial de ${ex.name}`}
                        >
                          {ex.name}
                          <span className="muted" style={{ fontSize: 10 }}>›</span>
                        </Link>
                        {sets ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                            {sets.map((s, i) => (
                              <span key={i} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                background: 'var(--surface)', border: '1px solid var(--border)',
                                borderRadius: 6, padding: '3px 8px',
                              }}>
                                <b style={{ fontSize: 10, color: 'var(--accent)' }}>S{s.num}</b>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                                  {s.weight}{s.unit} × {s.reps}{s.rir != null ? ` · RIR ${s.rir}` : ''}
                                </span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="muted" style={{ fontSize: 11, fontStyle: 'italic', marginTop: 4 }}>
                            — sin registro ({(ex.exercise_series ?? []).length} series planificadas)
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {day.exercises.length === 0 && (
                    <p className="muted" style={{ fontSize: 12 }}>Sin ejercicios en este día.</p>
                  )}
                </div>
              );
            })}

            {(cardio ?? []).length > 0 && (
              <div className="editor-day" style={{ marginTop: 16 }}>
                <h3 style={{ fontSize: 15, marginBottom: 10 }}>Cardio de la semana</h3>
                {(cardio ?? []).map((c) => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', padding: '8px 0', fontSize: 13 }}>
                    <span>{c.type}</span>
                    <span className="muted" style={{ fontFamily: 'var(--font-mono)' }}>
                      {c.duration_minutes} min · {formatShortDate(c.logged_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
