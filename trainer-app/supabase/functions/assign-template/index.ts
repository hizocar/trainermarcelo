// Edge Function: copia un programa (plantilla) a uno o varios clientes del
// coach. Desde la v39 un programa tiene SEMANAS explícitas: la semana N cae
// en la semana calendario actual+N-1 del alumno y la última queda repitiendo
// hacia adelante. Cada copia es 100% independiente; la plantilla no se toca.
// Las semanas pasadas del alumno tampoco: su historial se conserva.
//
// Despliegue: supabase functions deploy assign-template

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// La semana de programa "de hoy", con la fecha calendario de Chile — espejo
// de santiagoCurrentWeek() en web/src/lib/weeks.ts (misma época, misma
// fórmula). Los días copiados deben colgar de una plan_week: desde la v17
// cada semana es independiente y TODAS las vistas cargan días por
// plan_week_id — un día sin semana es invisible.
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

  let body: { templateId?: string; targetClientIds?: string[]; startWeek?: number };
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
  const { data: template } = await admin.from('program_templates').select('id, coach_id, name').eq('id', templateId).maybeSingle();
  if (!template || template.coach_id !== authUser.id) return json({ error: 'Programa inválido' }, 400);

  const { data: clients } = await admin.from('users').select('id, name, coach_id').in('id', targetClientIds);
  const byId = new Map((clients ?? []).map((c) => [c.id, c]));
  const invalidTargets = targetClientIds.filter((id) => byId.get(id)?.coach_id !== authUser.id);
  if (invalidTargets.length > 0) return json({ error: 'Uno o más clientes elegidos no son tuyos' }, 400);

  // las semanas del programa, con sus días; una plantilla anterior a la v39
  // (días sin semana) actúa como programa de una sola semana
  const { data: tplWeeks } = await admin
    .from('program_template_weeks')
    .select('id, week_number, name')
    .eq('template_id', templateId)
    .order('week_number');

  const { data: templateDays } = await admin
    .from('program_template_days')
    .select(`
      id, day_number, name, week_day, template_week_id,
      program_template_exercises (
        id, name, name_en, library_id, muscle_group, superseries_group,
        reps_objective, unit, ref_weight, order_index, image_url, video_url,
        notes, tempo, rest_seconds, target_rir,
        program_template_series ( series_number )
      )
    `)
    .eq('template_id', templateId);

  const allDays = templateDays ?? [];
  if (allDays.length === 0) return json({ error: 'Este programa todavía no tiene días para asignar' }, 400);

  const semanasPlantilla = (tplWeeks && tplWeeks.length > 0)
    ? tplWeeks
        .map((w) => ({ nombre: w.name, dias: allDays.filter((d) => d.template_week_id === w.id) }))
        .filter((w) => w.dias.length > 0)
    : [{ nombre: 'Semana 1', dias: allDays }];
  if (semanasPlantilla.length === 0) return json({ error: 'Este programa todavía no tiene días para asignar' }, 400);

  // la semana de inicio la elige el coach en el calendario; sin ella (o
  // inválida), el programa parte esta misma semana. Nunca en el pasado.
  const semanaActual = semanaActualSantiago();
  const pedida = Number(body.startWeek);
  const semanaBase = Number.isInteger(pedida) && pedida >= semanaActual && pedida <= semanaActual + 520
    ? pedida
    : semanaActual;

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

    // sanea los días huérfanos que dejó la versión pre-v17 de esta función
    // (sin plan_week_id: invisibles para todas las vistas)
    await admin.from('training_days').update({ archived: true })
      .eq('plan_id', targetPlan.id).is('plan_week_id', null).eq('archived', false);

    let okSemanas = 0;
    for (let i = 0; i < semanasPlantilla.length; i++) {
      const sem = semanasPlantilla[i];
      const numero = semanaBase + i;
      const esUltima = i === semanasPlantilla.length - 1;
      const nombre = semanasPlantilla.length > 1
        ? `${template.name} · ${sem.nombre}`
        : template.name;

      // El programa toma la semana actual y las siguientes del alumno; las
      // pasadas no se tocan. plan_weeks tiene unique (plan_id, week_number)
      // sin filtro por archived: si ya hay fila con ese número se REUTILIZA.
      const { data: previa } = await admin
        .from('plan_weeks').select('id')
        .eq('plan_id', targetPlan.id).eq('week_number', numero).maybeSingle();
      let weekId: string;
      if (previa) {
        await admin.from('training_days').update({ archived: true })
          .eq('plan_week_id', previa.id).eq('archived', false);
        const { error: upErr } = await admin.from('plan_weeks')
          .update({ name: nombre, is_deload: false, repeat_forever: esUltima, archived: false })
          .eq('id', previa.id);
        if (upErr) continue;
        weekId = previa.id;
      } else {
        const { data: creada, error: weekErr } = await admin.from('plan_weeks')
          .insert({ plan_id: targetPlan.id, week_number: numero, name: nombre, repeat_forever: esUltima })
          .select('id').single();
        if (weekErr || !creada) continue;
        weekId = creada.id;
      }

      for (const day of sem.dias) {
        const { data: newDay, error: dayErr } = await admin
          .from('training_days')
          .insert({ plan_id: targetPlan.id, plan_week_id: weekId, day_number: day.day_number, name: day.name, week_day: day.week_day })
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
      okSemanas++;
    }
    if (okSemanas > 0) copied++;
  }

  return json({ ok: true, copied, total: targetClientIds.length, semanas: semanasPlantilla.length });
});
