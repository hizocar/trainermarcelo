import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { signOut } from '../actions';
import Logo from '@/components/Logo';
import type { AppUser } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('id, name, role')
    .eq('id', user.id)
    .maybeSingle();

  if (me?.role !== 'coach') redirect('/login');

  const { data: clients } = await supabase
    .from('users')
    .select('id, name, email, avatar_url')
    .eq('role', 'client')
    .eq('coach_id', user.id)
    .order('name');

  const list = (clients ?? []) as AppUser[];

  return (
    <>
      <header className="app-header">
        <div className="container inner">
          <div className="brand">
            <Logo />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/library" className="btn btn-ghost" style={{ padding: '10px 18px' }}>BIBLIOTECA</Link>
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
          <p style={{ marginTop: 40 }} className="muted">
            Aún no tienes clientes asignados. Invítalos desde la app.
          </p>
        ) : (
          <div className="client-grid">
            {list.map((c) => (
              <Link key={c.id} href={`/clients/${c.id}`} className="client-card">
                <div className="avatar">{(c.name?.[0] ?? '?').toUpperCase()}</div>
                <h3>{c.name}</h3>
                <small>{c.email}</small>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
