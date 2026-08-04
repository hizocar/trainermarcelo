// Edge Function: el dueño de un gimnasio abre el portal de facturación de
// Stripe (actualizar tarjeta, ver boletas) o cancela su suscripción.
// Requiere JWT — solo el dueño autenticado puede tocar su propio gimnasio.
//
// Despliegue: supabase functions deploy manage-subscription

import Stripe from 'npm:stripe@17';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) return json({ error: 'Pagos no configurados todavía' }, 500);
  const stripe = new Stripe(stripeKey);

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

  const { data: gym } = await admin.from('gyms').select('stripe_customer_id, stripe_subscription_id').eq('id', me.gym_id).single();
  if (!gym?.stripe_customer_id) return json({ error: 'Este gimnasio no tiene una suscripción activa en Stripe' }, 400);

  let body: { action?: 'portal' | 'cancel'; returnUrl?: string };
  try { body = await req.json(); } catch { return json({ error: 'Cuerpo inválido' }, 400); }

  const site = Deno.env.get('SITE_URL') ?? 'https://elitefitapp.com';

  if (body.action === 'cancel') {
    if (!gym.stripe_subscription_id) return json({ error: 'Sin suscripción para cancelar' }, 400);
    await stripe.subscriptions.update(gym.stripe_subscription_id, { cancel_at_period_end: true });
    return json({ ok: true, message: 'La suscripción se cancelará al final del período ya pagado.' });
  }

  // por defecto: abrir el portal de facturación
  const portal = await stripe.billingPortal.sessions.create({
    customer: gym.stripe_customer_id,
    return_url: body.returnUrl ?? `${site}/dashboard`,
  });
  return json({ url: portal.url });
});
