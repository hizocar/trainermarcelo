// Edge Function: se llama desde /signup/enroll-return, la página a la que
// Flow redirige al terminar el registro de tarjeta. Acá recién se crea la
// suscripción real en Flow (primer cobro / inicio del trial) y, si eso sale
// bien, el gimnasio + la cuenta del coach en Supabase. Si el usuario
// abandonó el enrolamiento de tarjeta, esta función nunca se llama y no se
// creó ni se cobró nada.
//
// Despliegue: supabase functions deploy confirm-signup --no-verify-jwt
// (sin JWT: quien llama todavía no tiene cuenta)

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { flowCredentialsFromEnv, flowGet, flowPost, mapFlowSubscriptionStatus } from '../_shared/flow.ts';
import { PLAN_COACH_LIMIT, flowPlanEnvVar, isPlanTier, type Billing } from '../_shared/plans.ts';

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

  let body: { registerToken?: string };
  try { body = await req.json(); } catch { return json({ error: 'Cuerpo inválido' }, 400); }
  const registerToken = (body.registerToken ?? '').trim();
  if (!registerToken) return json({ error: 'Falta el token de registro' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    (Deno.env.get('SERVICE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    // 1) confirmar con Flow que la tarjeta quedó registrada
    const status = await flowGet(creds, '/customer/getRegisterStatus', { token: registerToken });
    const customerId = status.customerId as string | undefined;
    if (!customerId || String(status.status) !== '1') {
      return json({ error: 'No se pudo confirmar el registro de la tarjeta. Intenta nuevamente.' }, 400);
    }

    // idempotencia: si ya existe un gimnasio con este cliente Flow, no duplicar
    const { data: already } = await admin.from('gyms').select('id').eq('flow_customer_id', customerId).maybeSingle();
    if (already) return json({ ok: true });

    // 2) recuperar los datos del alta pendiente guardados en start-signup
    const { data: pending } = await admin.from('pending_signups').select('*').eq('flow_customer_id', customerId).maybeSingle();
    if (!pending || !isPlanTier(pending.plan_tier)) {
      return json({ error: 'No se encontró el alta pendiente para este cliente' }, 400);
    }
    const planTier = pending.plan_tier;
    const billing = (pending.billing === 'annual' ? 'annual' : 'monthly') as Billing;
    const planId = Deno.env.get(flowPlanEnvVar(planTier, billing));
    if (!planId) return json({ error: 'Ese plan ya no está disponible' }, 500);

    // 3) crear la suscripción — acá Flow genera el primer cobro (o el trial)
    const subscription = await flowPost(creds, '/subscription/create', { planId, customerId });
    const subscriptionStatus = mapFlowSubscriptionStatus(Number(subscription.status));

    // 4) crear la cuenta: el usuario podría ya existir si se reintentó el alta
    let userId: string;
    const { data: existingUser } = await admin.from('users').select('id').eq('email', pending.email).maybeSingle();
    if (existingUser) {
      userId = existingUser.id;
    } else {
      const site = Deno.env.get('SITE_URL') ?? 'https://elitefitapp.com';
      const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(pending.email, {
        data: { name: pending.name, role: 'coach_pending' },
        redirectTo: `${site}/set-password`,
      });
      if (inviteErr || !invited.user) throw new Error(inviteErr?.message ?? 'No se pudo invitar al coach');
      userId = invited.user.id;
    }

    const { data: gym, error: gymErr } = await admin.from('gyms').insert({
      name: pending.gym_name,
      owner_id: userId,
      plan_tier: planTier,
      coach_limit: PLAN_COACH_LIMIT[planTier],
      flow_customer_id: customerId,
      flow_subscription_id: subscription.subscriptionId,
      subscription_status: subscriptionStatus,
      billing_email: pending.email,
    }).select('id').single();
    if (gymErr) throw new Error(gymErr.message);

    await admin.from('users').update({ role: 'coach', is_owner: true, gym_id: gym.id, name: pending.name }).eq('id', userId);
    await admin.from('pending_signups').delete().eq('flow_customer_id', customerId);

    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'No se pudo confirmar el alta' }, 500);
  }
});
