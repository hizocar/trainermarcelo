// Edge Function: escucha eventos de Stripe y mantiene gyms/users en sincro.
// - checkout.session.completed → recién ahí se crea el gimnasio + la cuenta
//   del coach (invitación por email, sin contraseña en texto plano)
// - customer.subscription.updated → refleja cambios de plan / pago atrasado
// - customer.subscription.deleted → cancelación: se marca el gimnasio, no se
//   borra nada (el historial de sus clientes se conserva)
//
// Despliegue: supabase functions deploy stripe-webhook --no-verify-jwt
// Después: configurar el endpoint en Stripe Dashboard → Developers → Webhooks
// con estos 3 eventos, y cargar el signing secret como STRIPE_WEBHOOK_SECRET.

import Stripe from 'npm:stripe@17';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { PLAN_COACH_LIMIT, isPlanTier } from '../_shared/plans.ts';

Deno.serve(async (req) => {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!stripeKey || !webhookSecret) return new Response('Pagos no configurados', { status: 500 });

  const stripe = new Stripe(stripeKey);
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret);
  } catch (e) {
    return new Response(`Firma inválida: ${e instanceof Error ? e.message : e}`, { status: 400 });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const meta = session.metadata ?? {};
      const name = meta.name ?? '';
      const email = (meta.email ?? session.customer_email ?? '').toLowerCase();
      const gymName = meta.gym_name ?? `Gimnasio de ${name}`;
      const planTier = meta.plan_tier ?? '';
      if (!email || !isPlanTier(planTier)) {
        console.error('checkout.session.completed sin metadata válida', session.id);
        break;
      }

      // idempotencia: si ya existe un gym con este customer, no duplicar
      const customerId = session.customer as string;
      const { data: already } = await admin.from('gyms').select('id').eq('stripe_customer_id', customerId).maybeSingle();
      if (already) break;

      // el usuario podría ya existir si el pago se reintentó — reusar si es así
      let userId: string;
      const { data: existingUser } = await admin.from('users').select('id').eq('email', email).maybeSingle();
      if (existingUser) {
        userId = existingUser.id;
      } else {
        const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
          data: { name, role: 'coach_pending' },
        });
        if (inviteErr || !invited.user) {
          console.error('No se pudo invitar al coach', inviteErr);
          break;
        }
        userId = invited.user.id;
      }

      // el estado real (¿está en el trial de 14 días o ya pagó?) viene de la suscripción,
      // no asumir 'active' — si tiene trial, Stripe la crea como 'trialing'
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

      const { data: gym, error: gymErr } = await admin.from('gyms').insert({
        name: gymName,
        owner_id: userId,
        plan_tier: planTier,
        coach_limit: PLAN_COACH_LIMIT[planTier],
        stripe_customer_id: customerId,
        stripe_subscription_id: session.subscription as string,
        subscription_status: mapStripeStatus(subscription.status),
        billing_email: email,
      }).select('id').single();
      if (gymErr) { console.error('No se pudo crear el gimnasio', gymErr); break; }

      await admin.from('users').update({
        role: 'coach', is_owner: true, gym_id: gym.id, name,
      }).eq('id', userId);

      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const status = mapStripeStatus(sub.status);
      await admin.from('gyms')
        .update({ subscription_status: status })
        .eq('stripe_subscription_id', sub.id);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      // cancelación: se marca, no se borra nada — el historial del gimnasio se conserva
      await admin.from('gyms')
        .update({ subscription_status: 'canceled' })
        .eq('stripe_subscription_id', sub.id);
      break;
    }
  }

  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
});

function mapStripeStatus(s: Stripe.Subscription.Status): string {
  if (s === 'active' || s === 'trialing') return s;
  if (s === 'past_due' || s === 'unpaid') return 'past_due';
  if (s === 'canceled' || s === 'incomplete_expired') return 'canceled';
  return 'incomplete';
}
