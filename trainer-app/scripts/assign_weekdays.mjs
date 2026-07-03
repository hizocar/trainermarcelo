/**
 * Asigna días de la semana a los training_days existentes.
 * Plan por defecto: Lun=1, Mié=3, Jue=4, Vie=5
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const _env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
);

const sb = createClient(
  _env.SUPABASE_URL,
  _env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// day_number → week_day (Lun=1, Mié=3, Jue=4, Vie=5)
const DEFAULT_WEEKDAYS = { 1: 1, 2: 3, 3: 4, 4: 5 };

async function main() {
  const { data: days } = await sb
    .from('training_days')
    .select('id, day_number, name, week_day')
    .is('week_day', null);

  console.log(`Actualizando ${days?.length ?? 0} días sin weekday...`);

  for (const d of (days ?? [])) {
    const wday = DEFAULT_WEEKDAYS[d.day_number] ?? d.day_number;
    const { error } = await sb
      .from('training_days')
      .update({ week_day: wday })
      .eq('id', d.id);

    const names = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    if (!error) console.log(`  ✓ "${d.name}" (Día ${d.day_number}) → ${names[wday]}`);
    else console.error(`  ✗ ${d.name}`, error.message);
  }
  console.log('\n✅ Listo!');
}

main().catch(console.error);
