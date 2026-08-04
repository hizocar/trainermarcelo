import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import Logo from '@/components/Logo';
import SubscriptionActions from './SubscriptionActions';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  active: { label: 'Activa', tone: 'var(--text)' },
  trialing: { label: 'En prueba (14 días)', tone: 'var(--text)' },
  past_due: { label: 'Pago atrasado', tone: 'var(--text-muted)' },
  canceled: { label: 'Cancelada', tone: 'var(--text-muted)' },
  incomplete: { label: 'Pendiente de pago', tone: 'var(--text-muted)' },
};

export default async function SubscriptionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase.from('users').select('role, is_owner, gym_id').eq('id', user.id).maybeSingle();
  if (me?.role !== 'coach') redirect('/login');
  if (!me.is_owner) redirect('/dashboard');

  const { data: gym } = await supabase.from('gyms').select('*').eq('id', me.gym_id).maybeSingle();
  const status = STATUS_LABEL[gym?.subscription_status ?? 'active'] ?? STATUS_LABEL.active;

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

      <main className="container" style={{ paddingTop: 34, paddingBottom: 60, maxWidth: 640 }}>
        <span className="label accent">Facturación</span>
        <h1 className="display" style={{ fontSize: 40 }}>Mi suscripción</h1>

        <div className="editor-day" style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ marginBottom: 2 }}>{gym?.name}</h3>
              <span className="muted" style={{ fontSize: 13 }}>
                Plan {(gym?.plan_tier ?? '').toUpperCase()} · hasta {gym?.coach_limit} entrenador{gym?.coach_limit === 1 ? '' : 'es'}
              </span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: status.tone }}>
              {status.label.toUpperCase()}
            </span>
          </div>

          {gym?.subscription_status === 'past_due' && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              El último cobro falló. Actualiza tu método de pago para no perder acceso.
            </p>
          )}
          {gym?.subscription_status === 'canceled' && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Tu suscripción está cancelada. El historial de tus clientes se conserva — reactívala cuando quieras.
            </p>
          )}

          <SubscriptionActions hasFlow={!!gym?.flow_customer_id} />
        </div>

        <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>
          Los cobros se procesan con Flow, la pasarela de pago chilena. Ahí puedes actualizar tu
          tarjeta cuando quieras; para cancelar usa el botón de arriba.
        </p>
      </main>
    </>
  );
}
