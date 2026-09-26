// Edge Function: el usuario borra SU PROPIA cuenta (Google Play y Apple lo
// exigen apenas la app permite crear cuentas).
// Despliegue: supabase functions deploy delete-account
//
// 1. Verifica quién llama con su propio token: nunca se confía en el body,
//    así nadie puede borrar la cuenta de otro.
// 2. public.eliminar_cuenta (v47) borra todo en UNA transacción y devuelve los
//    archivos del Storage. Si el coach tiene una suscripción cobrándose en
//    Flow, o su gimnasio tiene más coaches, se niega y no toca nada.
// 3. Recién entonces se borran los archivos (la API de Storage es la que los
//    elimina de verdad). Si ese paso falla, la cuenta ya no existe: los
//    archivos quedan sin dueño y se reporta, pero no se revierte el borrado.
// 0. Cuenta creada con Apple: Apple exige revocar sus tokens al borrarla. La
//    app manda un authorization_code recién pedido (apple_authorization_code);
//    se canjea y se revoca ANTES de borrar. Necesita los secretos APPLE_TEAM_ID,
//    APPLE_KEY_ID y APPLE_PRIVATE_KEY (la clave .p8 de Sign in with Apple); sin
//    ellos, o si Apple falla, se borra igual y queda en el log: la persona
//    pidió irse y eso no se le niega por un tercero.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { importPKCS8, SignJWT } from 'npm:jose@5';

// ── Apple: canjear el código y revocar ──
async function revocarApple(codigo: string): Promise<string> {
  const teamId = Deno.env.get('APPLE_TEAM_ID');
  const keyId = Deno.env.get('APPLE_KEY_ID');
  const pem = Deno.env.get('APPLE_PRIVATE_KEY');
  const clientId = Deno.env.get('APPLE_CLIENT_ID') ?? 'com.trainermarcelo.app';
  if (!teamId || !keyId || !pem) return 'sin_configurar';

  // el client_secret de Apple es un JWT ES256 firmado con la clave .p8
  const clave = await importPKCS8(pem.replace(/\\n/g, '\n'), 'ES256');
  const secreto = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .setExpirationTime('5m')
    .setAudience('https://appleid.apple.com')
    .setSubject(clientId)
    .sign(clave);

  const form = (campos: Record<string, string>) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(campos),
  });

  const tok = await fetch('https://appleid.apple.com/auth/token', form({
    client_id: clientId, client_secret: secreto, code: codigo, grant_type: 'authorization_code',
  }));
  const cuerpo = await tok.json().catch(() => ({}));
  const token = cuerpo.refresh_token ?? cuerpo.access_token;
  if (!tok.ok || !token) return `canje_fallido:${cuerpo.error ?? tok.status}`;

  const rev = await fetch('https://appleid.apple.com/auth/revoke', form({
    client_id: clientId, client_secret: secreto, token,
    token_type_hint: cuerpo.refresh_token ? 'refresh_token' : 'access_token',
  }));
  return rev.ok ? 'revocado' : `revocacion_fallida:${rev.status}`;
}

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

// los rechazos de eliminar_cuenta, dichos para la persona
const MENSAJES: Record<string, string> = {
  suscripcion_activa:
    'Tienes una suscripción activa. Cancélala desde tu panel en elitefitapp.com y luego podrás eliminar tu cuenta.',
  gimnasio_con_otros_coaches:
    'Tu gimnasio tiene otros coaches. Escríbenos para traspasarlo antes de eliminar tu cuenta.',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = (Deno.env.get('SERVICE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!;
  const anonKey = (Deno.env.get('PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY'))!;

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user }, error: authErr } = await caller.auth.getUser();
  if (authErr || !user) return json({ error: 'No autenticado' }, 401);

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const body = await req.json().catch(() => ({})) as { apple_authorization_code?: string };
  let apple: string | undefined;
  if (typeof body.apple_authorization_code === 'string' && body.apple_authorization_code) {
    try {
      apple = await revocarApple(body.apple_authorization_code);
    } catch (e) {
      apple = 'error';
      console.error('delete-account: revocación de Apple', e instanceof Error ? e.message : e);
    }
    if (apple !== 'revocado') console.error(`delete-account: Apple ${apple} (usuario ${user.id})`);
  }

  const { data, error } = await admin.rpc('eliminar_cuenta', { p_user: user.id });
  if (error) {
    const conocido = MENSAJES[error.message];
    return json({ error: conocido ?? 'No se pudo eliminar la cuenta. Inténtalo de nuevo.', code: error.message },
      conocido ? 409 : 500);
  }

  // archivos: agrupados por bucket, de a 100 (límite de la API)
  const archivos = ((data as { archivos?: { bucket: string; name: string }[] })?.archivos) ?? [];
  const porBucket = new Map<string, string[]>();
  for (const a of archivos) porBucket.set(a.bucket, [...(porBucket.get(a.bucket) ?? []), a.name]);

  let archivosFallidos = 0;
  for (const [bucket, nombres] of porBucket) {
    for (let i = 0; i < nombres.length; i += 100) {
      const lote = nombres.slice(i, i + 100);
      const { error: stErr } = await admin.storage.from(bucket).remove(lote);
      if (stErr) {
        archivosFallidos += lote.length;
        console.error(`delete-account: no se borraron ${lote.length} archivos de ${bucket}`, stErr.message);
      }
    }
  }

  return json({ ok: true, archivos: archivos.length, archivosFallidos, apple });
});
