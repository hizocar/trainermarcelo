// Edge Function: el dueño de un gimnasio actualiza su tarjeta registrada en
// Flow o cancela su suscripción. Requiere JWT — solo el dueño autenticado
// puede tocar su propio gimnasio.
//
// Despliegue: supabase functions deploy manage-subscription

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { flowCredentialsFromEnv, flowPost } from '../_shared/flow.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const creds = flowCredentialsFromEnv();
  if (!creds) return json({ error: 'Pagos no configurados todavía' }, 500);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });

  const { data: { user: authUser }, error: authErr } = await caller.auth.getUser();
  if (authErr || !authUser) return json({ error: 'No autenticado' }, 401);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: me } = await admin.from('users').select('is_owner, gym_id').eq('id', authUser.id).single();
  if (!me?.is_owner || !me.gym_id) return json({ error: 'Solo el dueño del gimnasio puede gestionar la suscripción' }, 403);

  const { data: gym } = await admin.from('gyms').select('flow_customer_id, flow_subscription_id').eq('id', me.gym_id).single();
  if (!gym?.flow_customer_id) return json({ error: 'Este gimnasio no tiene una suscripción activa en Flow' }, 400);

  let body: { action?: 'update-card' | 'cancel'; returnUrl?: string };
  try { body = await req.json(); } catch { return json({ error: 'Cuerpo inválido' }, 400); }

  const site = Deno.env.get('SITE_URL') ?? 'https://elitefitapp.com';

  try {
    if (body.action === 'cancel') {
      if (!gym.flow_subscription_id) return json({ error: 'Sin suscripción para cancelar' }, 400);
      await flowPost(creds, '/subscription/cancel', {
        subscriptionId: gym.flow_subscription_id,
        at_period_end: 1,
      });
      return json({ ok: true, message: 'La suscripción se cancelará al final del período ya pagado.' });
    }

    // por defecto: reenrolar tarjeta (Flow no tiene un portal de facturación
    // como Stripe — el flujo equivalente es volver a registrar la tarjeta).
    // Flow redirige de vuelta con un POST — pasa por /api/flow/return.
    const returnTo = body.returnUrl ?? '/subscription';
    const register = await flowPost(creds, '/customer/register', {
      customerId: gym.flow_customer_id,
      url_return: `${site}/api/flow/return?to=${encodeURIComponent(returnTo)}`,
    });
    return json({ url: `${register.url}?token=${register.token}` });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'No se pudo completar la acción' }, 500);
  }
});
