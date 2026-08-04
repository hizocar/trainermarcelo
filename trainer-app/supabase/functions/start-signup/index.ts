// Edge Function: alta de coach autoservicio. No crea nada en Supabase todavía
// — solo abre una sesión de pago en Stripe. La cuenta real (gym + usuario) se
// crea recién cuando el webhook confirma el pago, así nunca queda un coach
// con acceso sin haber pagado.
//
// Despliegue: supabase functions deploy start-signup --no-verify-jwt
// (sin JWT: quien llama todavía no tiene cuenta)

import Stripe from 'npm:stripe@17';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { priceEnvVar, isPlanTier } from '../_shared/plans.ts';

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

  let body: { name?: string; email?: string; gymName?: string; planTier?: string; billing?: string; successUrl?: string; cancelUrl?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400);
  }

  const name = (body.name ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const gymName = (body.gymName ?? '').trim();
  const planTier = body.planTier ?? '';
  const billing = body.billing === 'annual' ? 'annual' : 'monthly';

  if (!name || !gymName) return json({ error: 'Nombre y nombre del negocio son obligatorios' }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Email inválido' }, 400);
  if (!isPlanTier(planTier)) return json({ error: 'Plan inválido' }, 400);

  const priceId = Deno.env.get(priceEnvVar(planTier, billing));
  if (!priceId) return json({ error: 'Ese plan todavía no está disponible para autoservicio' }, 400);

  // el email no puede tener ya una cuenta
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data: existing } = await admin.from('users').select('id').eq('email', email).maybeSingle();
  if (existing) return json({ error: 'Ese email ya tiene una cuenta. Inicia sesión en vez de registrarte.' }, 400);

  const site = Deno.env.get('SITE_URL') ?? 'https://elitefitapp.com';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: { name, email, gym_name: gymName, plan_tier: planTier },
      },
      metadata: { name, email, gym_name: gymName, plan_tier: planTier },
      success_url: body.successUrl ?? `${site}/signup/gracias?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: body.cancelUrl ?? `${site}/signup`,
      allow_promotion_codes: true,
    });
    return json({ url: session.url });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'No se pudo iniciar el pago' }, 500);
  }
});
