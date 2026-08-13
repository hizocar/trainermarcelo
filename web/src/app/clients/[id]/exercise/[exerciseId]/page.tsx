import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import Logo from '@/components/Logo';
import TrendChart from '@/components/TrendChart';
import type { AppUser } from '@/lib/types';
import { formatShortDate } from '@/lib/weeks';
import {
  continuityKey, groupHistoryByWeek, personalRecord, oneRepMax, type LogRow,
} from '@/lib/exerciseHistory';

export const dynamic = 'force-dynamic';

// Historial completo de UN ejercicio de UN alumno, a través de todas las
// semanas en que apareció (incluidas las semanas duplicadas, que crean filas
// nuevas de `exercises` — ver lib/exerciseHistory.ts).

export default async function ExerciseHistoryPage({
  params,
}: { params: Promise<{ id: string; exerciseId: string }> }) {
  const { id, exerciseId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== 'coach') redirect('/login');

  const { data: client } = await supabase
    .from('users').select('id, name, coach_id').eq('id', id).maybeSingle();
  if (!client || (client as AppUser).coach_id !== user.id) notFound();

  // el ejercicio de referencia (el que se tocó)
  const { data: ref } = await supabase
    .from('exercises')
    .select('id, name, name_en, unit, library_id, muscle_group, reps_objective')
    .eq('id', exerciseId)
    .maybeSingle();
  if (!ref) notFound();

  // todas las filas "hermanas" de ese ejercicio dentro del plan de ESTE alumno
  const { data: plan } = await supabase
    .from('workout_plans').select('id').eq('client_id', id).maybeSingle();
  if (!plan) notFound();

  // Sin filtro de `archived`: a diferencia del resto del repo, acá interesa
  // a propósito — archivar una semana no debe borrar los números históricos
  // de un ejercicio que ya se entrenó.
  const { data: allDays } = await supabase
    .from('training_days')
    .select('id, exercises ( id, name, library_id, exercise_series ( id, series_number ) )')
    .eq('plan_id', plan.id);

  const key = continuityKey(ref);
  const siblings = (allDays ?? [])
    .flatMap((d: any) => d.exercises ?? [])
    .filter((e: any) => continuityKey(e) === key);

  // si el ejercicio de referencia no pertenece al plan de este alumno, el
  // coach no tiene por qué verlo acá
  if (!siblings.some((e: any) => e.id === ref.id)) notFound();

  // sessionKeyBySeries: id de la fila de `exercises` de origen de cada serie.
  // Si el ejercicio está programado dos veces en la misma semana (ej. lunes
  // y jueves), cada fila es una sesión distinta y no hay que mezclarlas.
  const seriesNumber: Record<string, number> = {};
  const sessionKeyBySeries: Record<string, string> = {};
  siblings.forEach((e: any) =>
    (e.exercise_series ?? []).forEach((s: any) => {
      seriesNumber[s.id] = s.series_number;
      sessionKeyBySeries[s.id] = e.id;
    }));
  const seriesIds = Object.keys(seriesNumber);

  const { data: logs } = seriesIds.length
    ? await supabase
        .from('workout_logs')
        .select('series_id, week_number, weight, reps, rir, logged_at')
        .in('series_id', seriesIds)
    : { data: null };

  const history = groupHistoryByWeek((logs ?? []) as LogRow[], seriesNumber, sessionKeyBySeries);
  const pr = personalRecord(history);
  const prE1rm = pr ? oneRepMax(pr.weight, pr.reps) : null;

  // el gráfico va de la semana más antigua a la más reciente
  const chart = history.slice().reverse().map((w) => ({
    label: `S${w.week}`,
    value: Math.round(w.volume),
  }));

  return (
    <>
      <header className="app-header">
        <div className="container inner">
          <Link href="/dashboard" className="brand"><Logo /></Link>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href={`/clients/${id}/calendar`} className="btn btn-ghost" style={{ padding: '10px 18px' }}>
              CALENDARIO
            </Link>
            <Link href={`/clients/${id}/week`} className="btn btn-ghost" style={{ padding: '10px 18px' }}>
              ← SEMANA A SEMANA
            </Link>
          </div>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 34, paddingBottom: 60, maxWidth: 860 }}>
        <span className="label accent">Historial · {(client as AppUser).name}</span>
        <h1 className="display" style={{ fontSize: 40 }}>{ref.name}</h1>
        <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>
          {[ref.name_en, ref.muscle_group, ref.reps_objective ? `objetivo ${ref.reps_objective} reps` : null]
            .filter(Boolean).join(' · ')}
        </p>

        {history.length === 0 ? (
          <div className="editor-day" style={{ marginTop: 24, textAlign: 'center', padding: 40 }}>
            <p className="muted">
              Este alumno todavía no registra este ejercicio. Su progreso aparecerá acá semana a semana.
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
              {[
                { v: pr ? `${pr.weight}${ref.unit} × ${pr.reps}` : '—', l: `MEJOR MARCA${pr ? ` · S${pr.week}` : ''}` },
                { v: prE1rm ? `${Math.round(prE1rm)}${ref.unit}` : '—', l: '1RM ESTIMADO' },
                { v: String(history.length), l: 'SEMANAS REGISTRADAS' },
              ].map((s) => (
                <div key={s.l} className="editor-day" style={{ flex: 1, minWidth: 160, textAlign: 'center', padding: 16 }}>
                  <div className="display" style={{ fontSize: 24, color: 'var(--accent)' }}>{s.v}</div>
                  <div className="label muted" style={{ fontSize: 9, letterSpacing: 1 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {chart.length >= 2 && (
              <div className="editor-day" style={{ marginTop: 16 }}>
                <h3 style={{ marginBottom: 4 }}>Carga total por semana</h3>
                <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
                  Suma de peso × repeticiones de todas las series de ese ejercicio.
                </p>
                <TrendChart data={chart} unit={` ${ref.unit}`} />
              </div>
            )}

            <div className="editor-day" style={{ marginTop: 16 }}>
              <h3 style={{ marginBottom: 12 }}>Semana a semana</h3>
              {history.map((w) => (
                <div key={w.week} style={{ borderTop: '1px solid var(--border)', padding: '12px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 13 }}>SEMANA {w.week}</strong>
                    <span className="muted" style={{ fontSize: 12, marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>
                      {Math.round(w.volume).toLocaleString('es-CL')} {ref.unit} totales
                    </span>
                  </div>

                  {w.sessions.map((session, si) => (
                    <div key={session.key + si} style={{ marginTop: si === 0 ? 10 : 14 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                        {session.date && (
                          <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
                            {formatShortDate(session.date)}
                          </span>
                        )}
                        <span className="muted" style={{ fontSize: 11, marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>
                          {Math.round(session.volume).toLocaleString('es-CL')} {ref.unit}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                        {session.sets.map((s, i) => (
                          <span key={i} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            background: 'var(--surface)', border: '1px solid var(--border)',
                            borderRadius: 6, padding: '4px 9px',
                          }}>
                            <b style={{ fontSize: 10, color: 'var(--accent)' }}>S{s.series_number}</b>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                              {s.weight}{ref.unit} × {s.reps}{s.rir != null ? ` · RIR ${s.rir}` : ''}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
