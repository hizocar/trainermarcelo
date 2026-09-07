import { notFound } from 'next/navigation';
import { requireCoach } from '@/lib/guard';
import type { AppUser, PlanDay } from '@/lib/types';
import { resolveActiveWeek, type PlanWeek } from '@/lib/planWeeks';
import { santiagoCurrentWeek, santiagoDayKey } from '@/lib/weeks';
import { etiquetaAnimo, animoPromedio, formatoDuracion, adherencia } from '@/lib/tracking';
import PlanEditor from './PlanEditor';
import WeekManager from './WeekManager';
import CreatePlan from './CreatePlan';
import ClientFile from './ClientFile';
import ClientTabs from './ClientTabs';
import PlanEndDate from './PlanEndDate';
import AssignToClients from './AssignToClients';

export const dynamic = 'force-dynamic';

export default async function ClientPlanPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ weekId?: string }> }) {
  const { id } = await params;
  const { weekId: requestedWeekId } = await searchParams;
  const { supabase, userId } = await requireCoach();

  // el cliente debe pertenecer a este coach
  const { data: client } = await supabase
    .from('users')
    .select('id, name, email, coach_id, avatar_url')
    .eq('id', id)
    .maybeSingle();

  if (!client || (client as AppUser).coach_id !== userId) notFound();

  // La ficha inicial (PAR-Q): la respondió el alumno en su app; acá se lee.
  const { data: ficha } = await supabase
    .from('client_forms')
    .select('answers, updated_at')
    .eq('client_id', id).eq('kind', 'parq')
    .maybeSingle();

  const { data: otherClients } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('role', 'client')
    .eq('coach_id', userId)
    .neq('id', id)
    .order('name');

  const { data: plan } = await supabase.from('workout_plans').select('id, ends_at').eq('client_id', id).maybeSingle();

  // ficha privada del coach (notas + próxima revisión) — v33
  const { data: ficha33 } = await supabase
    .from('client_files')
    .select('notes, next_review_at')
    .eq('client_id', id)
    .maybeSingle();

  // resumen de tracking de los últimos 28 días (consultas de tamaño fijo)
  const desde = new Date(Date.now() - 28 * 86400000);
  const { data: sesiones } = await supabase
    .from('workout_sessions')
    .select('duration_seconds')
    .eq('user_id', id)
    .not('ended_at', 'is', null)
    .gte('started_at', desde.toISOString());

  const { data: animos } = await supabase
    .from('mood_logs')
    .select('mood')
    .eq('user_id', id)
    .gte('logged_date', santiagoDayKey(desde));

  const { data: logs28 } = plan
    ? await supabase
        .from('workout_logs')
        .select('rir, logged_at, exercise_series!inner ( exercises!inner ( training_days!inner ( plan_id ) ) )')
        .eq('exercise_series.exercises.training_days.plan_id', plan.id)
        .gte('logged_at', desde.toISOString())
    : { data: null };

  const { data: weeksData } = plan
    ? await supabase.from('plan_weeks').select('*').eq('plan_id', plan.id).eq('archived', false).order('week_number')
    : { data: null };
  const weeks = (weeksData ?? []) as PlanWeek[];

  // semana a editar: la que el coach eligió en el selector, o si no eligió
  // nada, la que esté activa para la semana calendario de hoy — si esa
  // tampoco existe, la más reciente que sí tenga.
  const selectedWeek: PlanWeek | null =
    (requestedWeekId && weeks.find(w => w.id === requestedWeekId)) ||
    resolveActiveWeek(weeks, santiagoCurrentWeek()) ||
    weeks[weeks.length - 1] ||
    null;

  const { data: daysData } = selectedWeek
    ? await supabase
        .from('training_days')
        .select(`
          id, plan_id, day_number, name, week_day, archived,
          exercises (
            id, day_id, name, name_en, library_id, muscle_group, reps_objective, unit,
            ref_weight, order_index, rest_seconds, target_rir, tempo, notes, video_url, archived,
            superseries_group,
            exercise_series ( id, exercise_id, series_number )
          )
        `)
        .eq('plan_week_id', selectedWeek.id)
    : { data: null };

  // archivados fuera del editor: siguen existiendo solo como historial del cliente
  const days: PlanDay[] = (daysData ?? [])
    .filter((d: any) => !d.archived)
    .map((d: any) => ({
      ...d,
      exercises: (d.exercises ?? [])
        .filter((e: any) => !e.archived)
        .slice()
        .sort((a: any, b: any) => a.order_index - b.order_index)
        .map((e: any) => ({
          ...e,
          exercise_series: (e.exercise_series ?? []).slice().sort(
            (a: any, b: any) => a.series_number - b.series_number,
          ),
        })),
    }))
    .sort((a: PlanDay, b: PlanDay) => a.day_number - b.day_number);

  // síntesis del tracking (los datos ya estaban en la base; esto es la lectura)
  const numSesiones = (sesiones ?? []).length;
  const tiempoMedio = numSesiones > 0
    ? formatoDuracion((sesiones ?? []).reduce((a, s) => a + (s.duration_seconds ?? 0), 0) / numSesiones)
    : null;
  const promAnimo = animoPromedio((animos ?? []).map((m: { mood: string }) => m.mood));
  const rirVals = (logs28 ?? []).map((l: any) => l.rir).filter((r: any): r is number => r != null);
  const rirMedio = rirVals.length > 0 ? rirVals.reduce((a, r) => a + r, 0) / rirVals.length : null;
  const diasEntrenados = new Set(
    (logs28 ?? []).filter((l: any) => l.logged_at).map((l: any) => santiagoDayKey(new Date(l.logged_at))),
  ).size;
  const planificadosSemana = days.filter(d => !d.name.toLowerCase().includes('libre')).length;
  const pctAdherencia = adherencia(diasEntrenados, planificadosSemana, 4);

  const tarjetas = [
    { v: String(numSesiones), l: 'SESIONES' },
    { v: tiempoMedio ?? '—', l: 'TIEMPO MEDIO' },
    { v: promAnimo != null ? (etiquetaAnimo(promAnimo) ?? '—') : '—', l: 'ÁNIMO', chico: true },
    { v: rirMedio != null ? rirMedio.toFixed(1) : '—', l: 'RIR MEDIO' },
    { v: pctAdherencia != null ? `${pctAdherencia}%` : '—', l: 'ADHERENCIA' },
  ];

  return (
    <>

      <main className="container" style={{ paddingTop: 34, paddingBottom: 40 }}>
        <span className="label accent">Editar plan</span>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            {(client as any).avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={(client as any).avatar_url} alt="" className="head-avatar" />
            ) : (
              <div className="head-avatar head-avatar-inicial">{((client as AppUser).name?.[0] ?? '?').toUpperCase()}</div>
            )}
            <h1 className="display" style={{ fontSize: 40 }}>{(client as AppUser).name}</h1>
          </div>
          {plan && (
            <AssignToClients
              sourceClientId={id}
              otherClients={(otherClients ?? []) as { id: string; name: string; email: string }[]}
            />
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 22 }}>
          <ClientTabs clientId={id} actual="plan" />

          <div>
            <span className="label muted" style={{ letterSpacing: 2 }}>Cómo viene · últimos 28 días</span>
            <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              {tarjetas.map((t) => (
                <div key={t.l} className="editor-day" style={{ flex: 1, minWidth: 130, textAlign: 'center', padding: 14 }}>
                  <div className="display" style={{ fontSize: t.chico ? 17 : 24, color: 'var(--accent)', lineHeight: 1.3 }}>
                    {t.v}
                  </div>
                  <div className="label muted" style={{ fontSize: 9, letterSpacing: 1 }}>{t.l}</div>
                </div>
              ))}
            </div>
          </div>

          <ClientFile
            clientId={id}
            coachId={userId}
            initialNotes={ficha33?.notes ?? ''}
            initialReview={ficha33?.next_review_at ?? null}
          />

          {plan && <PlanEndDate planId={plan.id} initialEndsAt={(plan as any).ends_at ?? null} />}

          <div>
            <span className="label muted" style={{ letterSpacing: 2 }}>Qué va a hacer</span>
            <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
              Su plan y sus semanas se editan aquí abajo.
            </p>
          </div>
        </div>

        {!plan ? (
          <CreatePlan clientId={id} clientName={(client as AppUser).name} coachId={userId} />
        ) : (
          <>
            <WeekManager planId={plan.id} weeks={weeks} selectedWeekId={selectedWeek?.id ?? null} clientId={id} />
            {selectedWeek ? (
              <PlanEditor key={selectedWeek.id} planId={plan.id} planWeekId={selectedWeek.id} initialDays={days} />
            ) : (
              <p className="muted" style={{ marginTop: 30 }}>
                Todavía no hay ninguna semana planificada. Crea la primera arriba en &quot;Gestión de semanas&quot;.
              </p>
            )}
          </>
        )}

        {ficha && (
          <details style={{
            marginTop: 32, border: '1px solid var(--border)', borderRadius: 12,
            background: 'var(--card)', padding: '4px 16px',
          }}>
            <summary className="label" style={{ cursor: 'pointer', padding: '10px 0' }}>
              FICHA INICIAL (PAR-Q)
              {Object.entries(ficha.answers as Record<string, unknown>)
                .filter(([k, v]) => k.startsWith('p') && v === true).length > 0 && (
                <span style={{ color: 'var(--warning)', marginLeft: 8 }}>
                  · {Object.entries(ficha.answers as Record<string, unknown>)
                      .filter(([k, v]) => k.startsWith('p') && v === true).length} respuesta(s) SÍ
                </span>
              )}
            </summary>
            <div style={{ padding: '8px 0 14px' }}>
              {[
                ['p1', 'Problema cardíaco diagnosticado (actividad solo con indicación médica)'],
                ['p2', 'Dolor en el pecho al hacer actividad física'],
                ['p3', 'Dolor en el pecho en reposo (último mes)'],
                ['p4', 'Mareos o pérdida de conocimiento'],
                ['p5', 'Problema óseo o articular que pueda empeorar'],
                ['p6', 'Medicamentos para presión o corazón'],
                ['p7', 'Otra razón para no hacer actividad física'],
              ].map(([id, texto]) => (
                <p key={id} style={{ fontSize: 13, margin: '6px 0' }}>
                  <strong className="mono" style={{
                    color: (ficha.answers as Record<string, unknown>)[id] === true
                      ? 'var(--warning)' : 'var(--text-muted)',
                  }}>
                    {(ficha.answers as Record<string, unknown>)[id] === true ? 'SÍ' : 'NO'}
                  </strong>
                  {'  '}<span className="muted">{texto}</span>
                </p>
              ))}
              {(ficha.answers as Record<string, unknown>).comentario ? (
                <p style={{ fontSize: 13, marginTop: 10 }}>
                  <span className="label">Comentario: </span>
                  {String((ficha.answers as Record<string, unknown>).comentario)}
                </p>
              ) : null}
            </div>
          </details>
        )}
      </main>
    </>
  );
}
