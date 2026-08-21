import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireCoach } from '@/lib/guard';
import type { AppUser, PlanDay } from '@/lib/types';
import { resolveActiveWeek, type PlanWeek } from '@/lib/planWeeks';
import { santiagoCurrentWeek } from '@/lib/weeks';
import PlanEditor from './PlanEditor';
import WeekManager from './WeekManager';
import AssignToClients from './AssignToClients';
import Logo from '@/components/Logo';

export const dynamic = 'force-dynamic';

export default async function ClientPlanPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ weekId?: string }> }) {
  const { id } = await params;
  const { weekId: requestedWeekId } = await searchParams;
  const { supabase, userId } = await requireCoach();

  // el cliente debe pertenecer a este coach
  const { data: client } = await supabase
    .from('users')
    .select('id, name, email, coach_id')
    .eq('id', id)
    .maybeSingle();

  if (!client || (client as AppUser).coach_id !== userId) notFound();

  const { data: otherClients } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('role', 'client')
    .eq('coach_id', userId)
    .neq('id', id)
    .order('name');

  const { data: plan } = await supabase.from('workout_plans').select('id').eq('client_id', id).maybeSingle();

  const { data: weeksData } = plan
    ? await supabase.from('plan_weeks').select('*').eq('plan_id', plan.id).eq('archived', false).order('week_number')
    : { data: null };
  const weeks = (weeksData ?? []) as PlanWeek[];

  // semana a editar: la que el coach eligió en el selector, o si no eligió
  // nada, la que esté activa para la semana calendario de hoy — si esa
  // tampoco existe, la más reciente que sí tenga.
  const selectedWeek: PlanWeek | null =
    (requestedWeekId && weeks.find(w => w.id === requestedWeekId)) ||
    resolveActiveWeek(weeks, santiagoCurrentWeek()) ||
    weeks[weeks.length - 1] ||
    null;

  const { data: daysData } = selectedWeek
    ? await supabase
        .from('training_days')
        .select(`
          id, plan_id, day_number, name, week_day, archived,
          exercises (
            id, day_id, name, name_en, library_id, muscle_group, reps_objective, unit,
            ref_weight, order_index, rest_seconds, target_rir, tempo, notes, archived,
            superseries_group,
            exercise_series ( id, exercise_id, series_number )
          )
        `)
        .eq('plan_week_id', selectedWeek.id)
    : { data: null };

  // archivados fuera del editor: siguen existiendo solo como historial del cliente
  const days: PlanDay[] = (daysData ?? [])
    .filter((d: any) => !d.archived)
    .map((d: any) => ({
      ...d,
      exercises: (d.exercises ?? [])
        .filter((e: any) => !e.archived)
        .slice()
        .sort((a: any, b: any) => a.order_index - b.order_index)
        .map((e: any) => ({
          ...e,
          exercise_series: (e.exercise_series ?? []).slice().sort(
            (a: any, b: any) => a.series_number - b.series_number,
          ),
        })),
    }))
    .sort((a: PlanDay, b: PlanDay) => a.day_number - b.day_number);

  return (
    <>
      <header className="app-header">
        <div className="container inner">
          <Link href="/dashboard" className="brand">
            <Logo />
          </Link>
          <Link href="/dashboard" className="btn btn-ghost" style={{ padding: '10px 18px' }}>
            ← CLIENTES
          </Link>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 34, paddingBottom: 40 }}>
        <span className="label accent">Editar plan</span>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <h1 className="display" style={{ fontSize: 40 }}>{(client as AppUser).name}</h1>
          {plan && (
            <AssignToClients
              sourceClientId={id}
              otherClients={(otherClients ?? []) as { id: string; name: string; email: string }[]}
            />
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 22 }}>
          <div>
            <span className="label muted" style={{ letterSpacing: 2 }}>Cómo va</span>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <Link href={`/clients/${id}/week`} className="btn btn-ghost" style={{ padding: '10px 16px' }}>
                ESTA SEMANA
              </Link>
              <Link href={`/clients/${id}/calendar`} className="btn btn-ghost" style={{ padding: '10px 16px' }}>
                CALENDARIO
              </Link>
              <Link href={`/clients/${id}/progress`} className="btn btn-ghost" style={{ padding: '10px 16px' }}>
                POR EJERCICIO
              </Link>
            </div>
          </div>

          <div>
            <span className="label muted" style={{ letterSpacing: 2 }}>Qué va a hacer</span>
            <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
              Su plan y sus semanas se editan aquí abajo.
            </p>
          </div>
        </div>

        {!plan ? (
          <p className="muted" style={{ marginTop: 30 }}>
            Este cliente aún no tiene un plan. Créalo desde la app y luego edítalo aquí.
          </p>
        ) : (
          <>
            <WeekManager planId={plan.id} weeks={weeks} selectedWeekId={selectedWeek?.id ?? null} clientId={id} />
            {selectedWeek ? (
              <PlanEditor key={selectedWeek.id} planId={plan.id} planWeekId={selectedWeek.id} initialDays={days} />
            ) : (
              <p className="muted" style={{ marginTop: 30 }}>
                Todavía no hay ninguna semana planificada. Crea la primera arriba en &quot;Gestión de semanas&quot;.
              </p>
            )}
          </>
        )}
      </main>
    </>
  );
}
