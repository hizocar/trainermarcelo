import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import Logo from '@/components/Logo';
import LibraryClient from './LibraryClient';

export const dynamic = 'force-dynamic';

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== 'coach') redirect('/login');

  const { data: library } = await supabase
    .from('exercise_library')
    .select('id, name, name_en, muscle_group, equipment, coach_id')
    .order('muscle_group')
    .order('name');

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

      <main className="container" style={{ paddingTop: 34, paddingBottom: 60 }}>
        <span className="label accent">Biblioteca</span>
        <h1 className="display" style={{ fontSize: 40 }}>Ejercicios</h1>
        <p className="muted" style={{ marginTop: 4, maxWidth: 560 }}>
          Ejercicios disponibles para armar planes — compartidos entre todos tus clientes.
          Los que agregas tú quedan marcados como propios.
        </p>

        <LibraryClient initialLibrary={library ?? []} coachId={user.id} />
      </main>
    </>
  );
}
