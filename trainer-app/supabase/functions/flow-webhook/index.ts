// Edge Function: notificación de Flow cuando un plan genera o cobra un
// importe de una suscripción (urlCallback configurada al crear cada plan).
// Flow llama por POST con el importe (invoiceId) o, en pagos sueltos, con
// un token — nunca confiamos en el cuerpo del POST: siempre volvemos a
// consultar el estado real a la API antes de tocar la base de datos.
// Debe responder 200 en menos de 15 segundos.
//
// Despliegue: supabase functions deploy flow-webhook --no-verify-jwt
// Después: cargar esta URL como urlCallback al crear cada plan (/plans/create).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { flowCredentialsFromEnv, flowGet, mapFlowSubscriptionStatus } from '../_shared/flow.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 });

  const creds = flowCredentialsFromEnv();
  if (!creds) return new Response('Pagos no configurados', { status: 500 });

  let invoiceId: string | null = null;
  try {
    const contentType = req.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const data = await req.json();
      invoiceId = data.invoiceId ?? null;
    } else {
      const form = await req.formData();
      invoiceId = (form.get('invoiceId') as string) ?? null;
    }
  } catch {
    return new Response('Cuerpo inválido', { status: 400 });
  }

  if (!invoiceId) {
    // no es una notificación de suscripción que nos interese — igual respondemos 200
    return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
  }

  try {
    // el importe nos da el subscriptionId; con eso pedimos el estado
    // autoritativo de la suscripción (nunca el del cuerpo del webhook)
    const invoice = await flowGet(creds, '/invoice/get', { invoiceId: Number(invoiceId) });
    const subscriptionId = invoice.subscriptionId as string | undefined;
    if (!subscriptionId) {
      return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    const subscription = await flowGet(creds, '/subscription/get', { subscriptionId });
    const status = mapFlowSubscriptionStatus(Number(subscription.status), Number(subscription.morose));

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    // cancelación o impago: se marca el gimnasio, no se borra nada — el
    // historial de sus clientes se conserva siempre
    await admin.from('gyms').update({ subscription_status: status }).eq('flow_subscription_id', subscriptionId);

    return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('flow-webhook error', e);
    // igual respondemos 200: Flow reintenta por correo si detecta error de
    // integración, pero no queremos que reintente indefinidamente por un
    // error nuestro transitorio ya logueado
    return new Response(JSON.stringify({ received: true, warning: 'processing error, logged' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
