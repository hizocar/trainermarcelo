// Edge Function: alta gratis de coach del marketplace. A diferencia de
// start-signup, acá no hay tarjeta ni Flow: la cuenta se crea entera de una
// vez y queda esperando aprobación (`marketplace_status = 'pending'`), con el
// gimnasio en `subscription_status = 'marketplace'`, que panelLocked() usa
// para dejarla solo con /marketplace hasta que reclame una solicitud.
//
// El plan_tier es 'solo' a propósito: lo que distingue a esta cuenta no es el
// plan sino el subscription_status. Si algún día paga de verdad, el webhook de
// Flow le escribe 'active' encima y todo lo demás ya calza.
//
// Despliegue: supabase functions deploy start-free-signup --no-verify-jwt
// (sin JWT: quien llama todavía no tiene cuenta)

import { createClient } from 'jsr:@supabase/supabase-js@2';

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

  let body: { name?: string; email?: string; gymName?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400);
  }

  const name = (body.name ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const gymName = (body.gymName ?? '').trim();

  if (!name || !gymName) return json({ error: 'Nombre y nombre del negocio son obligatorios' }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Email inválido' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: existing, error: existingErr } = await admin
    .from('users').select('id').eq('email', email).maybeSingle();
  // Un error tragado acá deja crear cuentas duplicadas: si no se pudo leer, no se sigue.
  if (existingErr) return json({ error: existingErr.message }, 500);
  if (existing) return json({ error: 'Ese email ya tiene una cuenta. Inicia sesión en vez de registrarte.' }, 400);

  const site = Deno.env.get('SITE_URL') ?? 'https://elitefitapp.com';

  // Los tres pasos de abajo no son una transacción: son tres sistemas
  // distintos (Auth, gyms, users). Por eso cada uno deshace los anteriores
  // si falla — sin eso queda una cuenta de Auth que no puede entrar (no tiene
  // gimnasio) ni volver a registrarse (el email ya está tomado).
  let userId: string | null = null;
  let gymId: string | null = null;

  const rollback = async () => {
    try {
      // El orden importa: users referencia gyms con NO ACTION, y public.users
      // no cuelga de auth.users con cascade, así que hay que borrarla a mano.
      if (userId) await admin.from('users').delete().eq('id', userId);
      if (gymId) await admin.from('gyms').delete().eq('id', gymId);
      if (userId) await admin.auth.admin.deleteUser(userId);
    } catch {
      // Si la limpieza falla, el error que importa es el original.
    }
  };

  try {
    // 1) crear la cuenta y mandar el correo para definir contraseña. Es la
    // misma llamada que usa confirm-signup para los coaches que pagan, así
    // que el correo que reciben es el mismo. El disparador handle_new_user
    // inserta la fila de public.users con role 'coach_pending'.
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { name, role: 'coach_pending' },
      redirectTo: `${site}/set-password`,
    });
    if (inviteErr || !invited.user) {
      const msg = inviteErr?.message.includes('already been registered')
        ? 'Ese email ya tiene una cuenta'
        : inviteErr?.message ?? 'No se pudo crear la cuenta';
      return json({ error: msg }, 400);
    }
    userId = invited.user.id;

    // 2) el gimnasio. owner_id es NOT NULL, por eso va después del usuario.
    const { data: gym, error: gymErr } = await admin.from('gyms').insert({
      name: gymName,
      owner_id: userId,
      plan_tier: 'solo',
      coach_limit: 1,
      subscription_status: 'marketplace',
      free_month_used: false,
    }).select('id').single();
    if (gymErr) throw new Error(gymErr.message);
    gymId = gym.id;

    // 3) completar el perfil. Es UPDATE, no INSERT: la fila ya existe por el
    // disparador. Y el rol tiene que quedar en 'coach' exacto — requireCoach
    // compara con igualdad y 'coach_pending' no pasa.
    const { error: linkErr } = await admin.from('users').update({
      role: 'coach',
      is_owner: true,
      gym_id: gymId,
      name,
      marketplace_status: 'pending',
    }).eq('id', userId);
    if (linkErr) throw new Error(linkErr.message);

    return json({ ok: true });
  } catch (e) {
    await rollback();
    return json({ error: e instanceof Error ? e.message : 'No se pudo completar el registro' }, 500);
  }
});
