import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import Logo from '@/components/Logo';
import TrendChart from '@/components/TrendChart';
import type { AppUser } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ClientProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== 'coach') redirect('/login');

  const { data: client } = await supabase
    .from('users').select('id, name, coach_id').eq('id', id).maybeSingle();
  if (!client || (client as AppUser).coach_id !== user.id) notFound();

  const { data: plan } = await supabase
    .from('workout_plans')
    .select(`
      id,
      training_days ( id, name, day_number, archived,
        exercises ( id, muscle_group, archived, exercise_series ( id ) )
      )
    `)
    .eq('client_id', id)
    .maybeSingle();

  const days = ((plan as any)?.training_days ?? []).filter((d: any) => !d.archived);
  const exercises = days.flatMap((d: any) => (d.exercises ?? []).filter((e: any) => !e.archived));

  // series por grupo muscular — misma cuenta que el app
  const groupCounts = new Map<string, number>();
  exercises.forEach((e: any) => {
    const g = (e.muscle_group ?? '').trim() || 'Sin grupo';
    groupCounts.set(g, (groupCounts.get(g) ?? 0) + (e.exercise_series?.length ?? 0));
  });
  const groups = Array.from(groupCounts.entries())
    .filter(([g]) => g !== 'Sin grupo')
    .sort((a, b) => b[1] - a[1]);
  const maxGroupSets = Math.max(...groups.map(([, c]) => c), 1);
  const totalSets = groups.reduce((a, [, c]) => a + c, 0);

  // carga total por semana — a partir de los logs reales del cliente
  const seriesIds = exercises.flatMap((e: any) => (e.exercise_series ?? []).map((s: any) => s.id));
  let weeklyVolume: { week: number; volume: number }[] = [];
  if (seriesIds.length > 0) {
    const { data: logs } = await supabase
      .from('workout_logs')
      .select('week_number, weight, reps')
      .in('series_id', seriesIds);

    const byWeek = new Map<number, number>();
    (logs ?? []).forEach((l: any) => {
      byWeek.set(l.week_number, (byWeek.get(l.week_number) ?? 0) + l.weight * l.reps);
    });
    weeklyVolume = Array.from(byWeek.entries())
      .map(([week, volume]) => ({ week, volume: Math.round(volume) }))
      .sort((a, b) => a.week - b.week);
  }

  return (
    <>
      <header className="app-header">
        <div className="container inner">
          <Link href="/dashboard" className="brand">
            <Logo />
          </Link>
          <Link href={`/clients/${id}`} className="btn btn-ghost" style={{ padding: '10px 18px' }}>
            ← PLAN
          </Link>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 34, paddingBottom: 60, maxWidth: 900 }}>
        <span className="label accent">Progreso</span>
        <h1 className="display" style={{ fontSize: 40 }}>{(client as AppUser).name}</h1>

        <div className="editor-day" style={{ marginTop: 24 }}>
          <h3 style={{ marginBottom: 4 }}>Carga total por semana</h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
            Suma de peso × repeticiones registradas, todas las semanas.
          </p>
          {weeklyVolume.length >= 2 ? (
            <TrendChart data={weeklyVolume.map((w) => ({ label: `S${w.week}`, value: w.volume }))} unit=" kg" />
          ) : (
            <p className="muted" style={{ fontSize: 13 }}>
              Aún no hay dos semanas completas para comparar.
            </p>
          )}
        </div>

        <div className="editor-day" style={{ marginTop: 20 }}>
          <h3 style={{ marginBottom: 4 }}>Series por grupo muscular</h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 18 }}>
            {days.length} días · {totalSets} series planificadas por semana — revisa solapes entre grupos.
          </p>
          {groups.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>Este cliente aún no tiene un plan con ejercicios.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {groups.map(([group, count]) => (
                <div key={group} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 130, fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>
                    {group.toUpperCase()}
                  </span>
                  <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--surface)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 999, background: 'var(--accent)', width: `${(count / maxGroupSets) * 100}%` }} />
                  </div>
                  <span style={{ width: 26, textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
