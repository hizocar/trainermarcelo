import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { signOut } from '../actions';
import Logo from '@/components/Logo';
import { loadCoachDashboard, type CoachDashboardRow } from '@/lib/coachDashboard';
import { santiagoDayKey } from '@/lib/weeks';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('id, name, role, is_owner')
    .eq('id', user.id)
    .maybeSingle();

  if (me?.role !== 'coach') redirect('/login');

  const list: CoachDashboardRow[] = await loadCoachDashboard(supabase, user.id);
  const atencion = list.filter((c) => c.status.needsAttention);
  const alDia = list.filter((c) => !c.status.needsAttention);

  const hoyKey = santiagoDayKey(new Date());
  const ayerKey = santiagoDayKey(new Date(Date.now() - 86400000));

  function ultimaVez(row: CoachDashboardRow): string {
    if (!row.lastTrainedKey) return 'sin registros en 2 semanas';
    if (row.lastTrainedKey === hoyKey) return 'entrenó hoy';
    if (row.lastTrainedKey === ayerKey) return 'entrenó ayer';
    const dias = Math.round(
      (new Date(hoyKey).getTime() - new Date(row.lastTrainedKey).getTime()) / 86400000,
    );
    return `hace ${dias} días`;
  }

  function detalle(row: CoachDashboardRow): string {
    if (row.status.total === 0) return 'sin plan asignado';
    return `${row.status.done} de ${row.status.total} días · ${ultimaVez(row)}`;
  }

  return (
    <>
      <header className="app-header">
        <div className="container inner">
          <div className="brand">
            <Logo />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/programs" className="btn btn-ghost" style={{ padding: '10px 18px' }}>PROGRAMAS</Link>
            <Link href="/library" className="btn btn-ghost" style={{ padding: '10px 18px' }}>BIBLIOTECA</Link>
            {me?.is_owner && (
              <Link href="/subscription" className="btn btn-ghost" style={{ padding: '10px 18px' }}>SUSCRIPCIÓN</Link>
            )}
            <form action={signOut}>
              <button className="btn btn-ghost" style={{ padding: '10px 18px' }}>SALIR</button>
            </form>
          </div>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
        <span className="label accent">Panel de coach · {me?.name ?? ''}</span>
        <h1 className="display" style={{ fontSize: 40 }}>Mis clientes</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)', fontWeight: 600 }}>
            {list.length}
          </span>{' '}
          {list.length === 1 ? 'cliente' : 'clientes'} · toca uno para editar su plan
        </p>

        {list.length === 0 ? (
          <p className="muted" style={{ marginTop: 30 }}>
            Todavía no tienes alumnos. Invita al primero con “+ Cliente”.
          </p>
        ) : (
          <>
            {atencion.length > 0 && (
              <>
                <span className="label" style={{ color: 'var(--warning)', letterSpacing: 2 }}>
                  Necesitan atención
                </span>
                <div className="client-grid" style={{ marginTop: 12, marginBottom: 28 }}>
                  {atencion.map((c) => (
                    <Link
                      key={c.id}
                      href={`/clients/${c.id}`}
                      className="client-card"
                      style={{ borderColor: 'var(--warning)' }}
                    >
                      <div className="avatar">{(c.name?.[0] ?? '?').toUpperCase()}</div>
                      <h3>{c.name}</h3>
                      <small style={{ color: 'var(--warning)' }}>{detalle(c)}</small>
                    </Link>
                  ))}
                </div>
              </>
            )}

            {alDia.length > 0 && (
              <>
                <span className="label muted" style={{ letterSpacing: 2 }}>
                  {atencion.length > 0 ? 'Al día' : 'Mis alumnos'}
                </span>
                <div className="client-grid" style={{ marginTop: 12 }}>
                  {alDia.map((c) => (
                    <Link key={c.id} href={`/clients/${c.id}`} className="client-card">
                      <div className="avatar">{(c.name?.[0] ?? '?').toUpperCase()}</div>
                      <h3>{c.name}</h3>
                      <small>{detalle(c)}</small>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}
