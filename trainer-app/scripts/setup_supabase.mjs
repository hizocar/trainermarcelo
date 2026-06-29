/**
 * Setup completo de Supabase para Trainer App.
 * Crea tablas, usuarios, plan y datos del Excel.
 * Uso: node scripts/setup_supabase.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as XLSX from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://nosebyewczvhsdohqrse.supabase.co';
const SERVICE_KEY = '***CLAVE-REVOCADA***';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const EXCEL_PATH = join(__dirname, '..', '..', 'Seguimiento Entrenamiento Seba Marcelo-1.xlsx');

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(msg) { console.log(`  ${msg}`); }
function ok(msg)  { console.log(`  ✓ ${msg}`); }
function fail(msg, err) { console.error(`  ✗ ${msg}`, err?.message ?? err ?? ''); }

async function runSQL(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body);
  }
  return res.json();
}

// ─── 1. Crear función exec_sql helper (bootstrap) ───────────────────────────

async function createExecSqlFunction() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: 'SELECT 1' }),
  });

  if (res.status === 404 || res.status === 400) {
    // La función no existe, la creamos via Management API directo
    log('Creando función exec_sql...');
    const createRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
    });
    // Fallback: usar pg via pooler
    return false;
  }
  return res.ok;
}

// ─── 2. Schema via pgREST workaround ────────────────────────────────────────

async function createSchema() {
  log('Creando schema de base de datos...');

  // Usamos la API de administración de Supabase para ejecutar SQL
  // a través del endpoint de query directo
  const queries = [
    // Tipos
    `DO $$ BEGIN
       CREATE TYPE IF NOT EXISTS public.user_role AS ENUM ('coach', 'client');
     EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
       CREATE TYPE IF NOT EXISTS public.unit_type AS ENUM ('kg', 'lb');
     EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,

    // Tabla users
    `CREATE TABLE IF NOT EXISTS public.users (
       id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
       name       text NOT NULL,
       role       public.user_role NOT NULL DEFAULT 'client',
       coach_id   uuid REFERENCES public.users(id),
       email      text NOT NULL,
       created_at timestamptz DEFAULT now()
     );`,

    // workout_plans
    `CREATE TABLE IF NOT EXISTS public.workout_plans (
       id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       client_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
       name       text NOT NULL,
       created_by uuid NOT NULL REFERENCES public.users(id),
       created_at timestamptz DEFAULT now()
     );`,

    // training_days
    `CREATE TABLE IF NOT EXISTS public.training_days (
       id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       plan_id     uuid NOT NULL REFERENCES public.workout_plans(id) ON DELETE CASCADE,
       day_number  int NOT NULL,
       name        text NOT NULL
     );`,

    // exercises
    `CREATE TABLE IF NOT EXISTS public.exercises (
       id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       day_id            uuid NOT NULL REFERENCES public.training_days(id) ON DELETE CASCADE,
       name              text NOT NULL,
       superseries_group text,
       reps_objective    text NOT NULL DEFAULT '8-12',
       unit              public.unit_type NOT NULL DEFAULT 'kg',
       ref_weight        float,
       order_index       int NOT NULL DEFAULT 0
     );`,

    // exercise_series
    `CREATE TABLE IF NOT EXISTS public.exercise_series (
       id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       exercise_id   uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
       series_number int NOT NULL
     );`,

    // workout_logs
    `CREATE TABLE IF NOT EXISTS public.workout_logs (
       id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       series_id   uuid NOT NULL REFERENCES public.exercise_series(id) ON DELETE CASCADE,
       week_number int NOT NULL,
       weight      float NOT NULL,
       reps        int NOT NULL,
       logged_at   timestamptz DEFAULT now(),
       logged_by   uuid NOT NULL REFERENCES public.users(id)
     );`,

    // RLS
    `ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE public.workout_plans ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE public.training_days ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE public.exercise_series ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;`,

    // Policies
    `DROP POLICY IF EXISTS "users_self" ON public.users;
     CREATE POLICY "users_self" ON public.users FOR ALL USING (auth.uid() = id);`,
    `DROP POLICY IF EXISTS "coach_sees_clients" ON public.users;
     CREATE POLICY "coach_sees_clients" ON public.users FOR SELECT USING (coach_id = auth.uid());`,
    `DROP POLICY IF EXISTS "plans_access" ON public.workout_plans;
     CREATE POLICY "plans_access" ON public.workout_plans FOR ALL USING (created_by = auth.uid() OR client_id = auth.uid());`,
    `DROP POLICY IF EXISTS "days_access" ON public.training_days;
     CREATE POLICY "days_access" ON public.training_days FOR SELECT USING (
       plan_id IN (SELECT id FROM public.workout_plans WHERE created_by = auth.uid() OR client_id = auth.uid())
     );`,
    `DROP POLICY IF EXISTS "exercises_access" ON public.exercises;
     CREATE POLICY "exercises_access" ON public.exercises FOR SELECT USING (
       day_id IN (SELECT id FROM public.training_days WHERE plan_id IN (
         SELECT id FROM public.workout_plans WHERE created_by = auth.uid() OR client_id = auth.uid()
       ))
     );`,
    `DROP POLICY IF EXISTS "series_access" ON public.exercise_series;
     CREATE POLICY "series_access" ON public.exercise_series FOR SELECT USING (
       exercise_id IN (SELECT id FROM public.exercises WHERE day_id IN (
         SELECT id FROM public.training_days WHERE plan_id IN (
           SELECT id FROM public.workout_plans WHERE created_by = auth.uid() OR client_id = auth.uid()
         )
       ))
     );`,
    `DROP POLICY IF EXISTS "logs_client" ON public.workout_logs;
     CREATE POLICY "logs_client" ON public.workout_logs FOR ALL USING (logged_by = auth.uid());`,
    `DROP POLICY IF EXISTS "logs_coach" ON public.workout_logs;
     CREATE POLICY "logs_coach" ON public.workout_logs FOR SELECT USING (
       logged_by IN (SELECT id FROM public.users WHERE coach_id = auth.uid())
     );`,

    // Trigger handle_new_user
    `CREATE OR REPLACE FUNCTION public.handle_new_user()
     RETURNS trigger AS $$
     BEGIN
       INSERT INTO public.users (id, email, name, role)
       VALUES (
         NEW.id,
         NEW.email,
         COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
         COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'client')
       )
       ON CONFLICT (id) DO NOTHING;
       RETURN NEW;
     END;
     $$ LANGUAGE plpgsql SECURITY DEFINER;`,

    `DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
     CREATE TRIGGER on_auth_user_created
       AFTER INSERT ON auth.users
       FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();`,
  ];

  for (const sql of queries) {
    const res = await fetch(`${SUPABASE_URL}/pg/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    });
    if (!res.ok) {
      const body = await res.text();
      // Ignorar errores de "ya existe"
      if (!body.includes('already exists') && !body.includes('duplicate')) {
        console.warn('    ⚠', sql.split('\n')[0].slice(0, 60), '→', body.slice(0, 100));
      }
    }
  }
  ok('Schema creado');
}

// ─── 3. Crear usuarios en Auth ───────────────────────────────────────────────

async function createUser(email, password, name, role) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role },
  });

  if (error && !error.message.includes('already been registered')) {
    fail(`createUser ${email}`, error);
    return null;
  }

  if (error?.message.includes('already been registered')) {
    const { data: list } = await supabase.auth.admin.listUsers();
    const existing = list?.users?.find(u => u.email === email);
    ok(`Usuario ya existe: ${email} (${existing?.id})`);
    return existing?.id ?? null;
  }

  ok(`Usuario creado: ${email} (${data.user.id})`);
  return data.user.id;
}

// ─── 4. Parsear Excel ────────────────────────────────────────────────────────

function parseSheet(ws, excludeLibre = true) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const days = [];
  let currentDay = null;
  let currentExercise = null;
  let currentSuperseries = undefined;

  for (const row of rows) {
    const col0 = String(row[0] ?? '').trim();
    const col1 = String(row[1] ?? '').trim();

    if (col0.startsWith('DÍA')) {
      const match = col0.match(/DÍA\s*(\d+)\s*[·\-·]\s*(.+)/);
      if (match) {
        const name = match[2].trim();
        if (excludeLibre && name.toLowerCase().includes('libre')) continue;
        currentDay = { dayNumber: parseInt(match[1]), name, exercises: [] };
        days.push(currentDay);
        currentExercise = null;
        currentSuperseries = undefined;
      }
      continue;
    }

    if (col0.includes('Superserie')) {
      currentSuperseries = col0.replace('🔗', '').trim();
      continue;
    }

    if (col0 === 'Ejercicio' || col0 === 'VOLUMEN SEMANAL' || col0 === 'Semana') continue;

    if (col1 === 'S1' && currentDay && col0) {
      currentExercise = {
        name: col0,
        superseriesGroup: currentSuperseries,
        repsObjective: String(row[2] ?? '8-12').trim(),
        unit: row[3] === 'lb' ? 'lb' : 'kg',
        refWeight: typeof row[4] === 'number' ? row[4] : null,
        series: [extractWeekly(row)],
      };
      currentDay.exercises.push(currentExercise);
      continue;
    }

    if ((col1 === 'S2' || col1 === 'S3') && currentExercise) {
      currentExercise.series.push(extractWeekly(row));
    }
  }

  return days;
}

function extractWeekly(row) {
  const data = [];
  for (let w = 0; w < 8; w++) {
    const weight = typeof row[5 + w * 2] === 'number' ? row[5 + w * 2] : null;
    const reps   = typeof row[6 + w * 2] === 'number' ? Math.round(row[6 + w * 2]) : null;
    if (weight !== null && reps !== null) data.push({ week: w + 1, weight, reps });
  }
  return data;
}

// ─── 5. Seed datos ───────────────────────────────────────────────────────────

async function seedClient(sheetName, clientId, coachId) {
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets[sheetName];
  if (!ws) { fail(`Sheet ${sheetName} not found`); return; }

  const days = parseSheet(ws);
  log(`${sheetName}: ${days.length} días encontrados`);

  // Crear plan
  const { data: plan, error: planErr } = await supabase
    .from('workout_plans')
    .insert({ client_id: clientId, name: `Plan ${sheetName}`, created_by: coachId })
    .select('id').single();

  if (planErr) { fail('crear plan', planErr); return; }

  for (const day of days) {
    const { data: dayRow, error: dayErr } = await supabase
      .from('training_days')
      .insert({ plan_id: plan.id, day_number: day.dayNumber, name: day.name })
      .select('id').single();

    if (dayErr) { fail(`día ${day.dayNumber}`, dayErr); continue; }

    for (let ei = 0; ei < day.exercises.length; ei++) {
      const ex = day.exercises[ei];
      const { data: exRow, error: exErr } = await supabase
        .from('exercises')
        .insert({
          day_id: dayRow.id,
          name: ex.name,
          superseries_group: ex.superseriesGroup ?? null,
          reps_objective: ex.repsObjective,
          unit: ex.unit,
          ref_weight: ex.refWeight,
          order_index: ei,
        })
        .select('id').single();

      if (exErr) { fail(`ejercicio ${ex.name}`, exErr); continue; }

      for (let si = 0; si < ex.series.length; si++) {
        const { data: seriesRow, error: sErr } = await supabase
          .from('exercise_series')
          .insert({ exercise_id: exRow.id, series_number: si + 1 })
          .select('id').single();

        if (sErr) { fail(`serie ${si + 1} de ${ex.name}`, sErr); continue; }

        const logs = ex.series[si]
          .filter(w => w.weight !== null && w.reps !== null)
          .map(w => ({
            series_id: seriesRow.id,
            week_number: w.week,
            weight: w.weight,
            reps: w.reps,
            logged_by: clientId,
          }));

        if (logs.length > 0) {
          const { error: logErr } = await supabase.from('workout_logs').insert(logs);
          if (logErr) fail(`logs ${ex.name} S${si+1}`, logErr);
        }
      }
    }

    ok(`Día ${day.dayNumber}: ${day.name} (${day.exercises.length} ejercicios)`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🏋️  Trainer App — Setup Supabase\n');

  // Crear schema
  console.log('📐 Creando schema...');
  await createSchema();

  // Crear usuarios
  console.log('\n👤 Creando usuarios...');
  const coachId  = await createUser('marcelo@trainerapp.com',   '***ROTADA***', 'Marcelo Herrera', 'coach');
  const sebId    = await createUser('sebastian@trainerapp.com', '***ROTADA***', 'Sebastián', 'client');
  const marceloClientId = await createUser('marceloclient@trainerapp.com', '***ROTADA***', 'Marcelo', 'client');

  if (!coachId || !sebId) {
    fail('No se pudo obtener los IDs de usuario, abortando seed');
    return;
  }

  // Asignar coach_id a clientes (bypass RLS con service key)
  await supabase.from('users').update({ coach_id: coachId, role: 'client' }).eq('id', sebId);
  if (marceloClientId) {
    await supabase.from('users').update({ coach_id: coachId, role: 'client' }).eq('id', marceloClientId);
  }
  await supabase.from('users').update({ role: 'coach' }).eq('id', coachId);
  ok('Roles y relaciones asignadas');

  // Seed datos del Excel
  console.log('\n📊 Importando datos del Excel...');
  await seedClient('Sebastián', sebId, coachId);
  if (marceloClientId) {
    await seedClient('Marcelo', marceloClientId, coachId);
  }

  console.log('\n✅ Setup completado!\n');
  console.log('  Coach:    marcelo@trainerapp.com   / ***ROTADA***');
  console.log('  Cliente:  sebastian@trainerapp.com / ***ROTADA***\n');
}

main().catch(err => { console.error('\n❌ Error:', err.message); process.exit(1); });
