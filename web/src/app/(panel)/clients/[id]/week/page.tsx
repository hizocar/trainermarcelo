import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireCoach } from '@/lib/guard';
import type { AppUser } from '@/lib/types';
import ClientTabs from '../ClientTabs';
import { resolveActiveWeek, type PlanWeek } from '@/lib/planWeeks';
import { santiagoCurrentWeek, formatShortDate } from '@/lib/weeks';
import WeekLive, { type DiaSemana, type LogSerie } from './WeekLive';

export const dynamic = 'force-dynamic';

// Vista semanal del coach: qué hizo REALMENTE el alumno cada día de una
// semana (peso y reps serie por serie), navegable hacia atrás y adelante
// igual que la app. Espejo de ClientWeekScreen.tsx en trainer-app.

export default async function ClientWeekPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ week?: string }> }) {
  const { id } = await params;
  const { week: weekParam } = await searchParams;
  const { supabase, userId } = await requireCoach();

  const { data: client } = await supabase
    .from('users').select('id, name, coach_id').eq('id', id).maybeSingle();
  if (!client || (client as AppUser).coach_id !== userId) notFound();

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
          exercises ( id, name, unit, ref_weight, order_index, archived,
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

  // logs de esta semana Y el último anterior por serie (para precargar el
  // peso, como hace WorkoutLogScreen en la app): una sola consulta ordenada
  // de más reciente a más antigua — el primero que aparezca < week gana.
  const seriesIds = days.flatMap((d: any) =>
    d.exercises.flatMap((e: any) => (e.exercise_series ?? []).map((s: any) => s.id)));
  const { data: todosLogs } = seriesIds.length
    ? await supabase.from('workout_logs')
        .select('series_id, week_number, weight, reps, rir, logged_at')
        .in('series_id', seriesIds).lte('week_number', week)
        .order('week_number', { ascending: false })
    : { data: null };

  const logs = (todosLogs ?? []).filter((l: any) => l.week_number === week);
  const previos: Record<string, { weight: number; reps: number; week: number }> = {};
  (todosLogs ?? []).forEach((l: any) => {
    if (l.week_number < week && !previos[l.series_id]) {
      previos[l.series_id] = { weight: l.weight, reps: l.reps, week: l.week_number };
    }
  });

  // datos serializables para el componente vivo (edición + refresco en línea)
  const diasVivos: DiaSemana[] = days.map((d: any) => ({
    id: d.id,
    day_number: d.day_number,
    name: d.name,
    week_day: d.week_day,
    exercises: d.exercises.map((e: any) => ({
      id: e.id,
      name: e.name,
      unit: e.unit,
      ref_weight: e.ref_weight ?? null,
      series: (e.exercise_series ?? [])
        .slice()
        .sort((a: any, b: any) => a.series_number - b.series_number)
        .map((s: any) => ({ id: s.id, num: s.series_number })),
    })),
  }));
  const logsVivos: LogSerie[] = (logs ?? []).map((l: any) => ({
    series_id: l.series_id, weight: l.weight, reps: l.reps, rir: l.rir, logged_at: l.logged_at,
  }));

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

  const cardioMin = (cardio ?? []).reduce((a, c) => a + c.duration_minutes, 0);

  return (
    <>

      <main className="container" style={{ paddingTop: 34, paddingBottom: 60, maxWidth: 900 }}>
        <span className="label accent">Progreso semanal</span>
        <h1 className="display" style={{ fontSize: 40 }}>{(client as AppUser).name}</h1>
        <ClientTabs clientId={id} actual="semana" />

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
            <WeekLive
              /* la key remonta el componente al cambiar de semana: sin ella el
                 estado interno (los logs) queda pegado a la semana anterior */
              key={`${activeWeek.id}:${week}`}
              clientId={id}
              coachId={userId}
              week={week}
              planWeekId={activeWeek.id}
              days={diasVivos}
              initialLogs={logsVivos}
              previos={previos}
              cardioMin={cardioMin}
              live={week === currentWeek}
            />

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
