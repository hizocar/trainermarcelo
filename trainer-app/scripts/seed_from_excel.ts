/**
 * Script para importar datos del Excel a Supabase.
 * Uso: npx ts-node scripts/seed_from_excel.ts
 * Requiere: SUPABASE_URL y SUPABASE_SERVICE_KEY en .env.local
 */

import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // service role key para bypass RLS
);

const EXCEL_PATH = path.join(__dirname, '..', '..', 'Seguimiento Entrenamiento Seba Marcelo-1.xlsx');

interface ExerciseRow {
  name: string;
  superseriesGroup?: string;
  repsObjective: string;
  unit: 'kg' | 'lb';
  refWeight?: number;
  series: Array<{ weeklyData: Array<{ week: number; weight?: number; reps?: number }> }>;
}

interface DayData {
  dayNumber: number;
  name: string;
  exercises: ExerciseRow[];
}

function parseSheet(ws: XLSX.WorkSheet): DayData[] {
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null });
  const days: DayData[] = [];
  let currentDay: DayData | null = null;
  let currentExercise: ExerciseRow | null = null;
  let currentSuperseries: string | undefined;
  let seriesCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as any[];
    const col0 = String(row[0] ?? '').trim();
    const col1 = String(row[1] ?? '').trim();

    // Detectar día
    if (col0.startsWith('DÍA')) {
      const match = col0.match(/DÍA (\d+)\s*[·\-]\s*(.+)/);
      if (match) {
        currentDay = {
          dayNumber: parseInt(match[1]),
          name: match[2].trim(),
          exercises: [],
        };
        days.push(currentDay);
        currentExercise = null;
        currentSuperseries = undefined;
        seriesCount = 0;
      }
      continue;
    }

    // Detectar superserie
    if (col0.includes('Superserie')) {
      currentSuperseries = col0.replace('🔗', '').trim();
      continue;
    }

    // Header row
    if (col0 === 'Ejercicio') continue;

    // Serie de ejercicio existente
    if (!col0 && (col1 === 'S2' || col1 === 'S3') && currentExercise) {
      const weeklyData = extractWeeklyData(row);
      currentExercise.series.push({ weeklyData });
      seriesCount++;
      continue;
    }

    // Nueva S1 (nuevo ejercicio)
    if (col1 === 'S1' && currentDay && col0) {
      currentExercise = {
        name: col0,
        superseriesGroup: currentSuperseries,
        repsObjective: String(row[2] ?? '8-12').trim(),
        unit: row[3] === 'lb' ? 'lb' : 'kg',
        refWeight: typeof row[4] === 'number' ? row[4] : undefined,
        series: [{ weeklyData: extractWeeklyData(row) }],
      };
      currentDay.exercises.push(currentExercise);
      seriesCount = 1;
    }
  }

  return days.filter(d => !d.name.toLowerCase().includes('libre'));
}

function extractWeeklyData(row: any[]): Array<{ week: number; weight?: number; reps?: number }> {
  const result = [];
  // Columns 5-20: Semana 1 peso (5), reps (6), Semana 2 peso (7), reps (8), ...
  for (let w = 0; w < 8; w++) {
    const weightIdx = 5 + w * 2;
    const repsIdx = 6 + w * 2;
    const weight = typeof row[weightIdx] === 'number' ? row[weightIdx] : undefined;
    const reps = typeof row[repsIdx] === 'number' ? Math.round(row[repsIdx]) : undefined;
    if (weight !== undefined || reps !== undefined) {
      result.push({ week: w + 1, weight, reps });
    }
  }
  return result;
}

async function getOrCreatePlan(clientId: string, coachId: string, name: string): Promise<string> {
  const { data: existing } = await supabase
    .from('workout_plans')
    .select('id')
    .eq('client_id', clientId)
    .single();

  if (existing) return existing.id;

  const { data } = await supabase
    .from('workout_plans')
    .insert({ client_id: clientId, name, created_by: coachId })
    .select('id')
    .single();

  return data!.id;
}

async function seedClient(sheetName: string, clientId: string, coachId: string) {
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets[sheetName];
  if (!ws) { console.error(`Sheet ${sheetName} not found`); return; }

  const days = parseSheet(ws);
  const planId = await getOrCreatePlan(clientId, coachId, `Plan ${sheetName}`);

  for (const day of days) {
    const { data: dayData } = await supabase
      .from('training_days')
      .insert({ plan_id: planId, day_number: day.dayNumber, name: day.name })
      .select('id')
      .single();

    if (!dayData) continue;

    for (let ei = 0; ei < day.exercises.length; ei++) {
      const ex = day.exercises[ei];
      const { data: exData } = await supabase
        .from('exercises')
        .insert({
          day_id: dayData.id,
          name: ex.name,
          superseries_group: ex.superseriesGroup ?? null,
          reps_objective: ex.repsObjective,
          unit: ex.unit,
          ref_weight: ex.refWeight ?? null,
          order_index: ei,
        })
        .select('id')
        .single();

      if (!exData) continue;

      for (let si = 0; si < ex.series.length; si++) {
        const s = ex.series[si];
        const { data: seriesData } = await supabase
          .from('exercise_series')
          .insert({ exercise_id: exData.id, series_number: si + 1 })
          .select('id')
          .single();

        if (!seriesData) continue;

        const logs = s.weeklyData
          .filter(w => w.weight !== undefined && w.reps !== undefined)
          .map(w => ({
            series_id: seriesData.id,
            week_number: w.week,
            weight: w.weight!,
            reps: w.reps!,
            logged_by: clientId,
          }));

        if (logs.length > 0) {
          await supabase.from('workout_logs').insert(logs);
        }
      }
    }

    console.log(`  ✓ Día ${day.dayNumber}: ${day.name} (${day.exercises.length} ejercicios)`);
  }
}

async function main() {
  console.log('🌱 Iniciando seed...\n');

  // IDs de los usuarios (crear en Supabase primero con Authentication > Users)
  // Luego reemplazar estos valores con los IDs reales
  const COACH_ID = process.env.COACH_USER_ID!;
  const SEBASTIAN_ID = process.env.SEBASTIAN_USER_ID!;
  const MARCELO_ID = process.env.MARCELO_USER_ID!;

  if (!COACH_ID || !SEBASTIAN_ID) {
    console.error('Falta COACH_USER_ID o SEBASTIAN_USER_ID en .env.local');
    process.exit(1);
  }

  console.log('📋 Seedeando Sebastián...');
  await seedClient('Sebastián', SEBASTIAN_ID, COACH_ID);

  if (MARCELO_ID) {
    console.log('\n📋 Seedeando Marcelo...');
    await seedClient('Marcelo', MARCELO_ID, COACH_ID);
  }

  console.log('\n✅ Seed completado!');
}

main().catch(console.error);
