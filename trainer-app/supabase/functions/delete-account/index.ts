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

  return json({ ok: true, archivos: archivos.length, archivosFallidos });
});
