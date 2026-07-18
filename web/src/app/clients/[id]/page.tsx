import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import type { AppUser, PlanDay } from '@/lib/types';
import PlanEditor from './PlanEditor';

export const dynamic = 'force-dynamic';

export default async function ClientPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== 'coach') redirect('/login');

  // el cliente debe pertenecer a este coach
  const { data: client } = await supabase
    .from('users')
    .select('id, name, email, coach_id')
    .eq('id', id)
    .maybeSingle();

  if (!client || (client as AppUser).coach_id !== user.id) notFound();

  const { data: plan } = await supabase
    .from('workout_plans')
    .select(`
      id,
      training_days (
        id, plan_id, day_number, name, week_day,
        exercises (
          id, day_id, name, muscle_group, reps_objective, unit,
          ref_weight, order_index, rest_seconds, target_rir, tempo, notes,
          exercise_series ( id, exercise_id, series_number )
        )
      )
    `)
    .eq('client_id', id)
    .maybeSingle();

  const days: PlanDay[] = ((plan as any)?.training_days ?? [])
    .map((d: any) => ({
      ...d,
      exercises: (d.exercises ?? [])
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
            <span className="brand-dot" />
            Marcelo Herrera
          </Link>
          <Link href="/dashboard" className="btn btn-ghost" style={{ padding: '10px 18px' }}>
            ← CLIENTES
          </Link>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 34, paddingBottom: 40 }}>
        <span className="label accent">Editar plan</span>
        <h1 className="display" style={{ fontSize: 40 }}>{(client as AppUser).name}</h1>

        {!plan ? (
          <p className="muted" style={{ marginTop: 30 }}>
            Este cliente aún no tiene un plan. Créalo desde la app y luego edítalo aquí.
          </p>
        ) : (
          <PlanEditor planId={(plan as any).id} initialDays={days} />
        )}
      </main>
    </>
  );
}
