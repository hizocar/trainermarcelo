import Link from 'next/link';
import Logo from '@/components/Logo';
import { requireCoach } from '@/lib/guard';
import { FREE_MONTH_STATUS } from '@/lib/marketplace';
import { signOut } from '../actions';
import RequestList, { type OpenRequest } from './RequestList';
import MyApplications, { type MyApplication } from './MyApplications';

export const dynamic = 'force-dynamic';

export default async function MarketplacePage() {
  // allowLocked: esta es justamente la página a la que se manda al coach
  // bloqueado. Sin la salida, el guard se redirige a sí mismo.
  const { supabase, me, gym, locked } = await requireCoach({ allowLocked: true });

  const { data, error } = await supabase
    .from('open_requests')
    .select('id, comuna, modality, goal, availability, created_at, slots_left, already_applied')
    .order('created_at', { ascending: false });

  // Un error tragado acá dibuja una bolsa vacía y le dice al coach "no hay
  // nadie buscando" cuando en realidad la consulta falló.
  if (error) throw error;

  const { data: mias, error: miasError } = await supabase
    .from('my_applications')
    .select('request_id, name, whatsapp, comuna, modality, goal, availability, applied_at, status')
    .order('applied_at', { ascending: false });
  if (miasError) throw miasError;

  // El componente ya oculta el WhatsApp en el render cuando la solicitud no
  // está abierta, pero Next.js serializa igual todos los props del client
  // component en el payload inicial (flight data): si no vaciamos el campo
  // acá, el número de una solicitud cerrada (incluida una que ganó otro
  // coach) queda recuperable con "ver código fuente" aunque la UI no lo
  // muestre. El dato tiene que dejar de viajar del servidor, no solo
  // esconderse al pintar.
  const misAplicaciones: MyApplication[] = (mias ?? []).map((a) => ({
    ...a,
    whatsapp: a.status === 'open' ? a.whatsapp : null,
  })) as MyApplication[];

  const pendiente = me.marketplace_status === 'pending';

  return (
    <>
      <header className="app-header">
        <div className="container inner">
          {/* Al bloqueado el logo no lo puede mandar a /dashboard: el guard lo
              devuelve acá mismo después de un ida y vuelta. */}
          <Link href={locked ? '/marketplace' : '/dashboard'} className="brand">
            <Logo />
          </Link>
          {locked ? (
            <form action={signOut}>
              <button className="btn btn-ghost" style={{ padding: '10px 18px' }}>CERRAR SESIÓN</button>
            </form>
          ) : (
            <Link href="/dashboard" className="btn btn-ghost" style={{ padding: '10px 18px' }}>
              VOLVER
            </Link>
          )}
        </div>
      </header>

      <main className="container" style={{ paddingTop: 32, paddingBottom: 64 }}>
        <h1 className="display">SOLICITUDES</h1>

        {pendiente && (
          // No es var(--warning): el ámbar acá se reserva para la solicitud
          // nueva con cupo, lo único que de verdad requiere que el coach actúe.
          // Estar "en revisión" no depende de él, es solo información.
          <p className="muted" style={{ fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
            Tu cuenta está en revisión. Cuando la aprobemos vas a poder postularte.
          </p>
        )}

        {locked && !pendiente && (
          // El mes de regalo ya se usó: prometerlo de nuevo sería mentirle.
          gym?.subscription_status === FREE_MONTH_STATUS ? (
            <p className="muted" style={{ fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
              Tu mes de regalo terminó. Tus alumnos y su historial siguen ahí:{' '}
              <a
                className="accent"
                href="https://wa.me/56949684325?text=Hola%2C%20quiero%20activar%20mi%20plan%20en%20EliteFitness"
                target="_blank"
                rel="noopener noreferrer"
              >
                escríbenos
              </a>{' '}
              para activar tu plan y volver a abrir el panel.
            </p>
          ) : (
            <p className="muted" style={{ fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
              El resto del panel se abre cuando tomes a tu primer alumno: ahí te regalamos
              un mes.
            </p>
          )
        )}

        <div style={{ marginTop: 24 }}>
          <RequestList initial={(data ?? []) as OpenRequest[]} />
        </div>

        <MyApplications initial={misAplicaciones} />
      </main>
    </>
  );
}
