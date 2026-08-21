// Edge Function: el coach crea la cuenta de un cliente desde la app.
// Despliegue:  supabase functions deploy invite-client
//
// Requiere que SUPABASE_SERVICE_ROLE_KEY esté disponible (Supabase la
// inyecta automáticamente en las Edge Functions).

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

  // 1. Verificar que quien llama es un COACH autenticado (nunca confiar en el body)
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
    .from('users').select('role').eq('id', authUser.id).single();

  if (profile?.role !== 'coach') {
    return json({ error: 'Solo un coach puede invitar clientes' }, 403);
  }

  // 2. Validar el cuerpo
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

  // 3. Crear el usuario en Auth (el trigger crea la fila en public.users)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role: 'client' },
  });

  if (createErr) {
    const msg = createErr.message.includes('already been registered')
      ? 'Ese email ya tiene una cuenta'
      : createErr.message;
    return json({ error: msg }, 400);
  }

  // 4. Vincular el cliente a este coach (rol forzado a 'client')
  const { error: linkErr } = await admin
    .from('users')
    .update({ coach_id: authUser.id, role: 'client', name })
    .eq('id', created.user.id);

  if (linkErr) return json({ error: linkErr.message }, 500);

  // 5. Registrar la invitación como aceptada
  await admin.from('invitations').insert({
    coach_id: authUser.id, email, name, status: 'accepted',
  });

  return json({ ok: true, client_id: created.user.id });
});
