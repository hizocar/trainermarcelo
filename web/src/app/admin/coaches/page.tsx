import Link from 'next/link';
import Logo from '@/components/Logo';
import { requireAdmin } from '@/lib/guard';
import ApprovalList, { type PendingCoach } from './ApprovalList';

export const dynamic = 'force-dynamic';

export default async function AdminCoachesPage() {
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase
    .from('pending_coaches')
    .select('id, name, email, instagram, created_at')
    .order('created_at', { ascending: true });
  if (error) throw error;

  const { data: stats, error: statsError } = await supabase
    .from('marketplace_stats')
    .select('solicitudes, postulaciones, tomadas')
    .maybeSingle();
  if (statsError) throw statsError;

  return (
    <>
      <header className="app-header">
        <div className="container inner">
          <Link href="/dashboard" className="brand">
            <Logo />
          </Link>
          <Link href="/dashboard" className="btn btn-ghost" style={{ padding: '10px 18px' }}>
            VOLVER
          </Link>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 32, paddingBottom: 64 }}>
        <p className="label" style={{ marginBottom: 8 }}>
        <a href="/admin/negocio" className="accent">→ VER EL NEGOCIO (EMBUDO Y MRR)</a>
      </p>
      <h1 className="display">COACHES POR APROBAR</h1>

        <div className="hero-stats" style={{ marginTop: 24, marginBottom: 32 }}>
          <div><strong className="mono">{stats?.solicitudes ?? 0}</strong><span>SOLICITUDES</span></div>
          <div><strong className="mono">{stats?.postulaciones ?? 0}</strong><span>POSTULACIONES</span></div>
          <div><strong className="mono">{stats?.tomadas ?? 0}</strong><span>TOMADAS</span></div>
        </div>

        <ApprovalList initial={(data ?? []) as PendingCoach[]} />
      </main>
    </>
  );
}
