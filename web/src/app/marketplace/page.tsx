import { requireCoach } from '@/lib/guard';
import RequestList, { type OpenRequest } from './RequestList';
import MyApplications, { type MyApplication } from './MyApplications';

export const dynamic = 'force-dynamic';

export default async function MarketplacePage() {
  // allowLocked: esta es justamente la página a la que se manda al coach
  // bloqueado. Sin la salida, el guard se redirige a sí mismo.
  const { supabase, me, locked } = await requireCoach({ allowLocked: true });

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

  const pendiente = me.marketplace_status === 'pending';

  return (
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
        <p className="muted" style={{ fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
          El resto del panel se abre cuando tomes a tu primer alumno: ahí te regalamos
          un mes.
        </p>
      )}

      <div style={{ marginTop: 24 }}>
        <RequestList initial={(data ?? []) as OpenRequest[]} />
      </div>

      <MyApplications initial={(mias ?? []) as MyApplication[]} />
    </main>
  );
}
