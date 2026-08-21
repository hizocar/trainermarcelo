// Edge Function: el dueño de un gimnasio crea la cuenta de un entrenador.
// Espejo de invite-client, con el cupo de coaches del plan como límite extra.
// Despliegue:  supabase functions deploy invite-coach

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = (Deno.env.get('SERVICE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!;
  const anonKey = (Deno.env.get('PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY'))!;

  // 1. Verificar que quien llama es el DUEÑO de un gimnasio (nunca confiar en el body)
  const authHeader = req.headers.get('Authorization') ?? '';
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user: authUser }, error: authErr } = await caller.auth.getUser();
  if (authErr || !authUser) return json({ error: 'No autenticado' }, 401);

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile } = await admin
    .from('users').select('role, is_owner, gym_id').eq('id', authUser.id).single();

  if (!profile?.is_owner || profile.role !== 'coach' || !profile.gym_id) {
    return json({ error: 'Solo el dueño de un gimnasio puede invitar entrenadores' }, 403);
  }

  // 2. Cupo del plan: no dejar invitar más coaches de los contratados
  const { data: gym } = await admin
    .from('gyms').select('coach_limit').eq('id', profile.gym_id).single();
  const { count: currentCoaches } = await admin
    .from('users').select('*', { count: 'exact', head: true })
    .eq('gym_id', profile.gym_id).eq('role', 'coach');

  if (gym && (currentCoaches ?? 0) >= gym.coach_limit) {
    return json({ error: `Alcanzaste el límite de ${gym.coach_limit} entrenadores de tu plan.` }, 400);
  }

  // 3. Validar el cuerpo
  let body: { name?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400);
  }

  const name = (body.name ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';

  if (!name || !email || password.length < 8) {
    return json({ error: 'Nombre, email y contraseña (mínimo 8 caracteres) son obligatorios' }, 400);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: 'Email inválido' }, 400);
  }

  // 4. Crear el usuario en Auth (el trigger crea la fila en public.users)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role: 'coach_pending' },
  });

  if (createErr) {
    const msg = createErr.message.includes('already been registered')
      ? 'Ese email ya tiene una cuenta'
      : createErr.message;
    return json({ error: msg }, 400);
  }

  // 5. Vincular el entrenador a este gimnasio (rol forzado a 'coach', no owner)
  const { error: linkErr } = await admin
    .from('users')
    .update({ gym_id: profile.gym_id, role: 'coach', is_owner: false, name })
    .eq('id', created.user.id);

  if (linkErr) return json({ error: linkErr.message }, 500);

  // 6. Registrar la invitación
  await admin.from('coach_invitations').insert({
    gym_id: profile.gym_id, email, name, status: 'accepted', invited_by: authUser.id,
  });

  return json({ ok: true, coach_id: created.user.id });
});
