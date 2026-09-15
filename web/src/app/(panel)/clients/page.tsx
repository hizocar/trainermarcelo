import Link from 'next/link';
import { loadCoachDashboard, detalleTexto, type CoachDashboardRow } from '@/lib/coachDashboard';
import { santiagoDayKey } from '@/lib/weeks';
import { requireCoach } from '@/lib/guard';

export const dynamic = 'force-dynamic';

// Todos los alumnos, cómo van. Esta grilla vivía en /dashboard; ahora el
// inicio responde "¿qué tengo que hacer hoy?" y esta página "¿cómo van todos?".
export default async function ClientsPage() {
  const { supabase, userId } = await requireCoach();

  const list: CoachDashboardRow[] = await loadCoachDashboard(supabase, userId);
  const atencion = list.filter((c) => c.status.needsAttention);
  const alDia = list.filter((c) => !c.status.needsAttention);
  const hoyKey = santiagoDayKey(new Date());

  return (
    <main className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <span className="label accent">Clientes</span>
      <h1 className="display" style={{ fontSize: 40 }}>
        {list.length === 0 ? 'Tus alumnos' : `${list.length} alumno${list.length === 1 ? '' : 's'}`}
      </h1>

      {list.length === 0 ? (
        <p className="muted" style={{ marginTop: 30 }}>
          Todavía no tienes alumnos. Invita al primero con “+ Cliente” desde la app.
        </p>
      ) : (
        <>
          {atencion.length > 0 && (
            <>
              <span className="label" style={{ color: 'var(--warning)', letterSpacing: 2, display: 'block', marginTop: 24 }}>
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
                    <div className="avatar">{c.avatar_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={c.avatar_url} alt="" />
                      : (c.name?.[0] ?? '?').toUpperCase()}</div>
                    <h3>{c.name}</h3>
                    <small style={{ color: 'var(--warning)' }}>{detalleTexto(c, hoyKey)}</small>
                  </Link>
                ))}
              </div>
            </>
          )}

          {alDia.length > 0 && (
            <>
              <span className="label muted" style={{ letterSpacing: 2, display: 'block', marginTop: atencion.length > 0 ? 0 : 24 }}>
                {atencion.length > 0 ? 'Al día' : 'Mis alumnos'}
              </span>
              <div className="client-grid" style={{ marginTop: 12 }}>
                {alDia.map((c) => (
                  <Link key={c.id} href={`/clients/${c.id}`} className="client-card">
                    <div className="avatar">{c.avatar_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={c.avatar_url} alt="" />
                      : (c.name?.[0] ?? '?').toUpperCase()}</div>
                    <h3>{c.name}</h3>
                    <small>{detalleTexto(c, hoyKey)}</small>
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
