/**
 * Seed de datos post-schema.
 * Crea perfiles de usuario y carga datos del Excel.
 * Uso: node scripts/seed_data.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://nosebyewczvhsdohqrse.supabase.co';
const SERVICE_KEY  = '***CLAVE-REVOCADA***';

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const EXCEL_PATH = join(__dirname, '..', '..', 'Seguimiento Entrenamiento Seba Marcelo-1.xlsx');

const USERS = {
  coach:    { id: '41ea0769-acf3-4033-955a-b87569412123', email: 'marcelo@trainerapp.com',   name: 'Marcelo Herrera',  role: 'coach'  },
  seb:      { id: '18e39545-1414-4064-8d6f-813ea9625ab9', email: 'sebastian@trainerapp.com', name: 'Sebastián',        role: 'client' },
  marcelo:  { id: 'add03c1f-149c-4b18-b946-a751f00cc98f', email: 'marceloclient@trainerapp.com', name: 'Marcelo', role: 'client' },
};

function ok(msg)   { console.log(`  ✓ ${msg}`); }
function fail(msg, e) { console.error(`  ✗ ${msg}`, e?.message ?? e ?? ''); }

// ── Crear perfiles en public.users ──────────────────────────────────────────
async function createProfiles() {
  const rows = [
    { id: USERS.coach.id,   email: USERS.coach.email,   name: USERS.coach.name,   role: 'coach',  coach_id: null },
    { id: USERS.seb.id,     email: USERS.seb.email,     name: USERS.seb.name,     role: 'client', coach_id: USERS.coach.id },
    { id: USERS.marcelo.id, email: USERS.marcelo.email, name: USERS.marcelo.name, role: 'client', coach_id: USERS.coach.id },
  ];

  for (const row of rows) {
    const { error } = await sb.from('users').upsert(row, { onConflict: 'id' });
    if (error) fail(`perfil ${row.name}`, error);
    else ok(`Perfil: ${row.name} (${row.role})`);
  }
}

// ── Parsear Excel ────────────────────────────────────────────────────────────
function parseSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const days = [];
  let currentDay = null;
  let currentExercise = null;
  let currentSuperseries = undefined;

  for (const row of rows) {
    const col0 = String(row[0] ?? '').trim();
    const col1 = String(row[1] ?? '').trim();

    if (col0.startsWith('DÍA')) {
      const match = col0.match(/DÍA\s*(\d+)\s*[·\-·]\s*(.+)/u);
      if (match) {
        const name = match[2].trim();
        if (name.toLowerCase().includes('libre')) { currentDay = null; continue; }
        currentDay = { dayNumber: parseInt(match[1]), name, exercises: [] };
        days.push(currentDay);
        currentExercise = null;
        currentSuperseries = undefined;
      }
      continue;
    }

    if (col0.includes('Superserie')) { currentSuperseries = col0.replace('🔗', '').trim(); continue; }
    if (col0 === 'Ejercicio' || col0.startsWith('VOLUMEN') || col0 === 'Semana' || !currentDay) continue;

    if (col1 === 'S1' && col0) {
      currentExercise = {
        name: col0,
        superseriesGroup: currentSuperseries ?? null,
        repsObjective: String(row[2] ?? '8-12').trim(),
        unit: row[3] === 'lb' ? 'lb' : 'kg',
        refWeight: typeof row[4] === 'number' ? row[4] : null,
        series: [extractWeekly(row)],
      };
      currentDay.exercises.push(currentExercise);
    } else if ((col1 === 'S2' || col1 === 'S3') && currentExercise) {
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

// ── Seed un cliente ──────────────────────────────────────────────────────────
async function seedClient(sheetName, clientId, coachId) {
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets[sheetName];
  if (!ws) { fail(`Sheet ${sheetName} no encontrado`); return; }

  const days = parseSheet(ws);
  console.log(`\n  📋 ${sheetName}: ${days.length} días`);

  const { data: plan, error: planErr } = await sb
    .from('workout_plans')
    .insert({ client_id: clientId, name: `Plan ${sheetName}`, created_by: coachId })
    .select('id').single();

  if (planErr) { fail('crear plan', planErr); return; }

  for (const day of days) {
    const { data: dayRow, error: dErr } = await sb
      .from('training_days')
      .insert({ plan_id: plan.id, day_number: day.dayNumber, name: day.name })
      .select('id').single();
    if (dErr) { fail(`día ${day.dayNumber}`, dErr); continue; }

    for (let ei = 0; ei < day.exercises.length; ei++) {
      const ex = day.exercises[ei];
      const { data: exRow, error: eErr } = await sb
        .from('exercises')
        .insert({
          day_id: dayRow.id,
          name: ex.name,
          superseries_group: ex.superseriesGroup,
          reps_objective: ex.repsObjective,
          unit: ex.unit,
          ref_weight: ex.refWeight,
          order_index: ei,
        })
        .select('id').single();
      if (eErr) { fail(`ejercicio ${ex.name}`, eErr); continue; }

      for (let si = 0; si < ex.series.length; si++) {
        const { data: sRow, error: sErr } = await sb
          .from('exercise_series')
          .insert({ exercise_id: exRow.id, series_number: si + 1 })
          .select('id').single();
        if (sErr) { fail(`serie ${si+1}`, sErr); continue; }

        const logs = ex.series[si].map(w => ({
          series_id: sRow.id,
          week_number: w.week,
          weight: w.weight,
          reps: w.reps,
          logged_by: clientId,
        }));
        if (logs.length > 0) {
          const { error: lErr } = await sb.from('workout_logs').insert(logs);
          if (lErr) fail(`logs ${ex.name} S${si+1}`, lErr);
        }
      }
    }
    ok(`Día ${day.dayNumber}: ${day.name} (${day.exercises.length} ejercicios)`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🏋️  Trainer App — Seed de datos\n');

  console.log('👤 Creando perfiles...');
  await createProfiles();

  console.log('\n📊 Importando datos del Excel...');
  await seedClient('Sebastián', USERS.seb.id, USERS.coach.id);
  await seedClient('Marcelo', USERS.marcelo.id, USERS.coach.id);

  console.log('\n✅ Seed completado!\n');
  console.log('  Coach:   marcelo@trainerapp.com      / ***ROTADA***');
  console.log('  Cliente: sebastian@trainerapp.com    / ***ROTADA***');
  console.log('  Cliente: marceloclient@trainerapp.com / ***ROTADA***\n');
}

main().catch(err => { console.error('\n❌', err.message); process.exit(1); });
