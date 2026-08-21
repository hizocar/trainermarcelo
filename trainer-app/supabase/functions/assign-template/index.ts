// Edge Function: copia un programa (plantilla, sin cliente asignado) a uno
// o varios clientes del coach. Cada copia queda 100% independiente desde
// el momento en que se crea — la plantilla sigue existiendo tal cual para
// volver a usarla después. Si el cliente destino ya tenía un plan, sus
// días actuales se archivan (no se borran: su historial se conserva).
//
// Despliegue: supabase functions deploy assign-template

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

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = (Deno.env.get('PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY'))!;
  const authHeader = req.headers.get('Authorization') ?? '';
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });

  const { data: { user: authUser }, error: authErr } = await caller.auth.getUser();
  if (authErr || !authUser) return json({ error: 'No autenticado' }, 401);

  let body: { templateId?: string; targetClientIds?: string[] };
  try { body = await req.json(); } catch { return json({ error: 'Cuerpo inválido' }, 400); }
  const templateId = body.templateId ?? '';
  const targetClientIds = Array.from(new Set(body.targetClientIds ?? []));
  if (!templateId) return json({ error: 'Falta el programa a asignar' }, 400);
  if (targetClientIds.length === 0) return json({ error: 'Elige al menos un cliente' }, 400);

  const admin = createClient(url, (Deno.env.get('SERVICE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: me } = await admin.from('users').select('role').eq('id', authUser.id).maybeSingle();
  if (me?.role !== 'coach') return json({ error: 'Solo un coach puede hacer esto' }, 403);

  // el coach solo puede asignar SUS propias plantillas a SUS propios clientes
  const { data: template } = await admin.from('program_templates').select('id, coach_id').eq('id', templateId).maybeSingle();
  if (!template || template.coach_id !== authUser.id) return json({ error: 'Programa inválido' }, 400);

  const { data: clients } = await admin.from('users').select('id, name, coach_id').in('id', targetClientIds);
  const byId = new Map((clients ?? []).map((c) => [c.id, c]));
  const invalidTargets = targetClientIds.filter((id) => byId.get(id)?.coach_id !== authUser.id);
  if (invalidTargets.length > 0) return json({ error: 'Uno o más clientes elegidos no son tuyos' }, 400);

  const { data: templateDays } = await admin
    .from('program_template_days')
    .select(`
      id, day_number, name, week_day,
      program_template_exercises (
        id, name, name_en, library_id, muscle_group, superseries_group,
        reps_objective, unit, ref_weight, order_index, image_url, video_url,
        notes, tempo, rest_seconds, target_rir,
        program_template_series ( series_number )
      )
    `)
    .eq('template_id', templateId);

  const days = templateDays ?? [];
  if (days.length === 0) return json({ error: 'Este programa todavía no tiene días para asignar' }, 400);

  let copied = 0;
  for (const targetId of targetClientIds) {
    let { data: targetPlan } = await admin.from('workout_plans').select('id').eq('client_id', targetId).maybeSingle();
    if (!targetPlan) {
      const target = byId.get(targetId)!;
      const { data: created, error: createErr } = await admin
        .from('workout_plans')
        .insert({ client_id: targetId, name: `Plan ${target.name}`, created_by: authUser.id })
        .select('id')
        .single();
      if (createErr || !created) continue;
      targetPlan = created;
    }

    await admin.from('training_days').update({ archived: true }).eq('plan_id', targetPlan.id).eq('archived', false);

    for (const day of days) {
      const { data: newDay, error: dayErr } = await admin
        .from('training_days')
        .insert({ plan_id: targetPlan.id, day_number: day.day_number, name: day.name, week_day: day.week_day })
        .select('id')
        .single();
      if (dayErr || !newDay) continue;

      // deno-lint-ignore no-explicit-any
      for (const ex of (day.program_template_exercises ?? []) as any[]) {
        const { data: newEx, error: exErr } = await admin
          .from('exercises')
          .insert({
            day_id: newDay.id,
            name: ex.name,
            name_en: ex.name_en,
            library_id: ex.library_id,
            muscle_group: ex.muscle_group,
            superseries_group: ex.superseries_group,
            reps_objective: ex.reps_objective,
            unit: ex.unit,
            ref_weight: ex.ref_weight,
            order_index: ex.order_index,
            image_url: ex.image_url,
            video_url: ex.video_url,
            notes: ex.notes,
            tempo: ex.tempo,
            rest_seconds: ex.rest_seconds,
            target_rir: ex.target_rir,
          })
          .select('id')
          .single();
        if (exErr || !newEx) continue;

        // deno-lint-ignore no-explicit-any
        const seriesRows = (ex.program_template_series ?? []).map((s: any) => ({
          exercise_id: newEx.id,
          series_number: s.series_number,
        }));
        if (seriesRows.length > 0) await admin.from('exercise_series').insert(seriesRows);
      }
    }
    copied++;
  }

  return json({ ok: true, copied, total: targetClientIds.length });
});
