// Edge Function: envía un push a todos los dispositivos del destinatario.
// La llama el trigger notify_new_message (migración v14) al insertarse un mensaje.
// Despliegue:  supabase functions deploy send-push
//
// Verify JWT: NO (la llama el trigger de la base, no un usuario). Desplegar con
//   supabase functions deploy send-push --no-verify-jwt

import { createClient } from 'jsr:@supabase/supabase-js@2';

const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 });

  let payload: { recipient_id?: string; title?: string; body?: string };
  try {
    payload = await req.json();
  } catch {
    return new Response('Cuerpo inválido', { status: 400 });
  }

  const { recipient_id, title, body } = payload;
  if (!recipient_id || !body) return new Response('Faltan campos', { status: 400 });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // tokens del destinatario
  const { data: tokens } = await admin
    .from('push_tokens')
    .select('token')
    .eq('user_id', recipient_id);

  if (!tokens || tokens.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { headers: { 'Content-Type': 'application/json' } });
  }

  const messages = tokens.map((t) => ({
    to: t.token,
    title: title ?? 'Nuevo mensaje',
    body,
    sound: 'default',
    priority: 'high',
    channelId: 'chat',
    data: { type: 'chat' },
  }));

  const res = await fetch(EXPO_PUSH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });

  const result = await res.json().catch(() => ({}));

  // Limpiar tokens que Expo reporta como inválidos (DeviceNotRegistered)
  const receipts = result?.data ?? [];
  const dead: string[] = [];
  receipts.forEach((r: any, i: number) => {
    if (r?.details?.error === 'DeviceNotRegistered') dead.push(tokens[i].token);
  });
  if (dead.length) {
    await admin.from('push_tokens').delete().eq('user_id', recipient_id).in('token', dead);
  }

  return new Response(JSON.stringify({ sent: messages.length - dead.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
