// Edge Function: copia el plan completo (días, ejercicios, series) de un
// cliente a otros clientes del mismo coach de una sola vez. Cada copia
// queda 100% independiente — si el coach después ajusta el peso o las
// reps a un cliente puntual, no afecta a los demás. Si el cliente
// destino ya tenía un plan, sus días actuales se archivan (no se
// borran: su historial se conserva) y se reemplazan por los nuevos.
//
// Despliegue: supabase functions deploy duplicate-plan

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};


// La semana de programa "de hoy" en hora de Chile — espejo de
// santiagoCurrentWeek() (web/src/lib/weeks.ts). Desde la v17 cada semana es
// independiente y las vistas cargan días por plan_week_id: copiar días sin
// semana los hacía invisibles (mismo bug que assign-template).
const TRAINING_EPOCH = new Date('2026-06-15T00:00:00');
function semanaActualSantiago(): number {
  const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
  const d = new Date(`${key}T00:00:00`);
  const diff = Math.floor((d.getTime() - TRAINING_EPOCH.getTime()) / (7 * 86400000));
  return Math.max(1, diff + 1);
}

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

  let body: { sourceClientId?: string; targetClientIds?: string[] };
  try { body = await req.json(); } catch { return json({ error: 'Cuerpo inválido' }, 400); }
  const sourceClientId = body.sourceClientId ?? '';
  const targetClientIds = Array.from(new Set((body.targetClientIds ?? []).filter((id) => id !== sourceClientId)));
  if (!sourceClientId) return json({ error: 'Falta el cliente origen' }, 400);
  if (targetClientIds.length === 0) return json({ error: 'Elige al menos un cliente destino' }, 400);

  const admin = createClient(url, (Deno.env.get('SERVICE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // solo un coach puede hacer esto, y solo entre SUS propios clientes
  const { data: me } = await admin.from('users').select('role').eq('id', authUser.id).maybeSingle();
  if (me?.role !== 'coach') return json({ error: 'Solo un coach puede hacer esto' }, 403);

  const { data: relevantClients } = await admin
    .from('users')
    .select('id, name, coach_id')
    .in('id', [sourceClientId, ...targetClientIds]);
  const byId = new Map((relevantClients ?? []).map((c) => [c.id, c]));
  const source = byId.get(sourceClientId);
  if (!source || source.coach_id !== authUser.id) return json({ error: 'Cliente origen inválido' }, 400);
  const invalidTargets = targetClientIds.filter((id) => byId.get(id)?.coach_id !== authUser.id);
  if (invalidTargets.length > 0) return json({ error: 'Uno o más clientes destino no son tuyos' }, 400);

  const semana = semanaActualSantiago();

  // el origen: su semana ACTIVA para la semana calendario de hoy (exacta, o
  // la última repeat_forever anterior — el mismo resolveActiveWeek de web)
  const { data: sourcePlan } = await admin
    .from('workout_plans').select('id').eq('client_id', sourceClientId).maybeSingle();
  if (!sourcePlan) return json({ error: 'El cliente origen no tiene plan' }, 400);

  const { data: sourceWeeks } = await admin
    .from('plan_weeks').select('id, week_number, name, repeat_forever')
    .eq('plan_id', sourcePlan.id).eq('archived', false);
  const exacta = (sourceWeeks ?? []).find((w) => w.week_number === semana);
  const fallback = (sourceWeeks ?? [])
    .filter((w) => w.week_number < semana && w.repeat_forever)
    .sort((a, b) => b.week_number - a.week_number)[0];
  const sourceWeek = exacta ?? fallback;
  if (!sourceWeek) return json({ error: 'El cliente origen no tiene una semana activa para copiar' }, 400);

  const { data: sourceDaysData } = await admin
    .from('training_days')
    .select(`
      id, day_number, name, week_day, archived,
      exercises (
        id, name, name_en, library_id, muscle_group, superseries_group,
        reps_objective, unit, ref_weight, order_index, image_url, video_url,
        notes, tempo, rest_seconds, target_rir, archived,
        exercise_series ( series_number )
      )
    `)
    .eq('plan_week_id', sourceWeek.id);

  // deno-lint-ignore no-explicit-any
  const sourceDays = (sourceDaysData ?? []).filter((d: any) => !d.archived);
  if (sourceDays.length === 0) {
    return json({ error: 'El cliente origen no tiene un plan con días para copiar' }, 400);
  }

  let copied = 0;
  for (const targetId of targetClientIds) {
    // plan del destino: reusar si existe, crear si no
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

    // la copia toma la semana ACTUAL del destino (unique plan_id+week_number
    // sin filtro por archived: si la fila existe, se reutiliza)
    const { data: previa } = await admin
      .from('plan_weeks').select('id')
      .eq('plan_id', targetPlan.id).eq('week_number', semana).maybeSingle();
    let weekId: string;
    if (previa) {
      await admin.from('training_days').update({ archived: true })
        .eq('plan_week_id', previa.id).eq('archived', false);
      const { error: upErr } = await admin.from('plan_weeks')
        .update({ name: sourceWeek.name, is_deload: false, repeat_forever: true, archived: false })
        .eq('id', previa.id);
      if (upErr) continue;
      weekId = previa.id;
    } else {
      const { data: creada, error: weekErr } = await admin.from('plan_weeks')
        .insert({ plan_id: targetPlan.id, week_number: semana, name: sourceWeek.name, repeat_forever: true })
        .select('id').single();
      if (weekErr || !creada) continue;
      weekId = creada.id;
    }

    // sanea días huérfanos de la versión anterior (sin plan_week_id)
    await admin.from('training_days').update({ archived: true })
      .eq('plan_id', targetPlan.id).is('plan_week_id', null).eq('archived', false);

    for (const day of sourceDays) {
      const { data: newDay, error: dayErr } = await admin
        .from('training_days')
        .insert({ plan_id: targetPlan.id, plan_week_id: weekId, day_number: day.day_number, name: day.name, week_day: day.week_day })
        .select('id')
        .single();
      if (dayErr || !newDay) continue;

      // deno-lint-ignore no-explicit-any
      const activeExercises = (day.exercises ?? []).filter((e: any) => !e.archived);
      for (const ex of activeExercises) {
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
        const seriesRows = (ex.exercise_series ?? []).map((s: any) => ({
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
