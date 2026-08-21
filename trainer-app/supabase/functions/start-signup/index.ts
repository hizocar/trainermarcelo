// Edge Function: alta de coach autoservicio. No crea nada en Supabase
// todavía ni cobra nada — solo crea el cliente en Flow y devuelve la URL
// para que registre su tarjeta. La suscripción (y el primer cobro) recién
// se crea en confirm-signup, después de que Flow confirme el registro de
// la tarjeta. Así nunca queda un coach con acceso sin haber pagado, y si
// el usuario abandona a mitad de camino no se le cobra nada.
//
// Despliegue: supabase functions deploy start-signup --no-verify-jwt
// (sin JWT: quien llama todavía no tiene cuenta)

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { flowCredentialsFromEnv, flowPost } from '../_shared/flow.ts';
import { flowPlanEnvVar, isPlanTier, type Billing } from '../_shared/plans.ts';

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

  let body: { name?: string; email?: string; gymName?: string; planTier?: string; billing?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400);
  }

  const name = (body.name ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const gymName = (body.gymName ?? '').trim();
  const planTier = body.planTier ?? '';
  const billing: Billing = body.billing === 'annual' ? 'annual' : 'monthly';

  if (!name || !gymName) return json({ error: 'Nombre y nombre del negocio son obligatorios' }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Email inválido' }, 400);
  if (!isPlanTier(planTier)) return json({ error: 'Plan inválido' }, 400);

  const planId = Deno.env.get(flowPlanEnvVar(planTier, billing));
  if (!planId) return json({ error: 'Ese plan todavía no está disponible para autoservicio' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    (Deno.env.get('SERVICE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // el email no puede tener ya una cuenta
  const { data: existing } = await admin.from('users').select('id').eq('email', email).maybeSingle();
  if (existing) return json({ error: 'Ese email ya tiene una cuenta. Inicia sesión en vez de registrarte.' }, 400);

  const site = Deno.env.get('SITE_URL') ?? 'https://elitefitapp.com';

  try {
    // 1) crear (o reutilizar) el cliente en Flow
    const externalId = crypto.randomUUID();
    const customer = await flowPost(creds, '/customer/create', { name, email, externalId });
    const customerId = customer.customerId as string;

    // 2) guardar los datos del alta pendiente — Flow no tiene un campo de
    // metadata libre como Stripe, así que los guardamos nosotros y los
    // recuperamos en confirm-signup usando el customerId como llave.
    const { error: pendingErr } = await admin.from('pending_signups').upsert({
      flow_customer_id: customerId,
      name,
      email,
      gym_name: gymName,
      plan_tier: planTier,
      billing,
    }, { onConflict: 'flow_customer_id' });
    if (pendingErr) throw new Error(pendingErr.message);

    // 3) pedir la URL de registro de tarjeta. Flow redirige de vuelta a
    // url_return con un POST (no GET) — pasa por /api/flow/return, que
    // normaliza el token a query param antes de entregarlo a la página.
    const register = await flowPost(creds, '/customer/register', {
      customerId,
      url_return: `${site}/api/flow/return?to=%2Fsignup%2Fenroll-return`,
    });

    return json({ url: `${register.url}?token=${register.token}` });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'No se pudo iniciar el alta' }, 500);
  }
});
