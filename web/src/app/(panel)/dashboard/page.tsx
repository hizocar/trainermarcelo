import Link from 'next/link';
import { loadCoachDashboard, type CoachDashboardRow } from '@/lib/coachDashboard';
import { santiagoDayKey } from '@/lib/weeks';
import { requireCoach } from '@/lib/guard';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { supabase, userId, me } = await requireCoach();

  const list: CoachDashboardRow[] = await loadCoachDashboard(supabase, userId);
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
    if (!row.planExists) return 'sin plan asignado';
    if (!row.activeWeekExists) return 'sin semana planificada';
    if (row.status.total === 0) return 'semana sin días';
    return `${row.status.done} de ${row.status.total} días · ${ultimaVez(row)}`;
  }

  // saludo con hora y fecha de Chile — el panel te habla a ti, no "al coach"
  const ahora = new Date();
  const horaStgo = parseInt(new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago', hour: 'numeric', hour12: false,
  }).format(ahora), 10);
  const saludo = horaStgo < 6 ? 'Buenas noches' : horaStgo < 12 ? 'Buenos días' : horaStgo < 20 ? 'Buenas tardes' : 'Buenas noches';
  const fechaStgo = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago', weekday: 'long', day: 'numeric', month: 'long',
  }).format(ahora);
  const primerNombre = (me?.name ?? '').split(' ')[0];
  const entrenaronHoy = list.filter((c) => c.lastTrainedKey === hoyKey).length;

  return (
    <>
      <main className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
          <span className="label accent" style={{ textTransform: 'capitalize' }}>{fechaStgo}</span>
          {me?.is_platform_admin && (
            <Link href="/admin/coaches" className="label" style={{ letterSpacing: 2 }}>ADMIN →</Link>
          )}
        </div>
        <h1 className="display" style={{ fontSize: 40 }}>
          {saludo}{primerNombre ? `, ${primerNombre}` : ''}
        </h1>

        <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
          {[
            { v: String(list.length), l: list.length === 1 ? 'ALUMNO' : 'ALUMNOS', alerta: false },
            { v: String(entrenaronHoy), l: 'ENTRENARON HOY', alerta: false },
            { v: String(atencion.length), l: 'NECESITAN ATENCIÓN', alerta: atencion.length > 0 },
          ].map((s) => (
            <div key={s.l} className="editor-day" style={{
              flex: 1, minWidth: 150, textAlign: 'center', padding: 16,
              ...(s.alerta ? { borderColor: 'var(--warning)' } : {}),
            }}>
              <div className="display" style={{ fontSize: 26, color: s.alerta ? 'var(--warning)' : 'var(--accent)' }}>
                {s.v}
              </div>
              <div className="label muted" style={{ fontSize: 9, letterSpacing: 1 }}>{s.l}</div>
            </div>
          ))}
        </div>

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
                      <div className="avatar">{c.avatar_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={c.avatar_url} alt="" />
                        : (c.name?.[0] ?? '?').toUpperCase()}</div>
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
                      <div className="avatar">{c.avatar_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={c.avatar_url} alt="" />
                        : (c.name?.[0] ?? '?').toUpperCase()}</div>
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
