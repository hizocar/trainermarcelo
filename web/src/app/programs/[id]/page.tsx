import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import type { PlanDay } from '@/lib/types';
import TemplateEditor from './TemplateEditor';
import AssignTemplateToClients from './AssignTemplateToClients';
import EditableName from './EditableName';
import EditableDuration from './EditableDuration';
import Logo from '@/components/Logo';

export const dynamic = 'force-dynamic';

export default async function ProgramEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== 'coach') redirect('/login');

  const { data: template } = await supabase
    .from('program_templates')
    .select('id, name, coach_id, duration_weeks')
    .eq('id', id)
    .maybeSingle();

  if (!template || template.coach_id !== user.id) notFound();

  const { data: days } = await supabase
    .from('program_template_days')
    .select(`
      id, template_id, day_number, name, week_day,
      program_template_exercises (
        id, day_id, name, name_en, library_id, muscle_group, superseries_group,
        reps_objective, unit, ref_weight, order_index, rest_seconds, target_rir, tempo, notes,
        program_template_series ( id, exercise_id, series_number )
      )
    `)
    .eq('template_id', id)
    .order('day_number');

  // adaptar al shape de PlanDay que ya usa el editor (mismos nombres de campo,
  // solo cambia exercise_series ← program_template_series y day_id ← program_template_exercises.day_id)
  const planDays: PlanDay[] = (days ?? []).map((d: any) => ({
    id: d.id,
    plan_id: d.template_id,
    day_number: d.day_number,
    name: d.name,
    week_day: d.week_day,
    exercises: (d.program_template_exercises ?? [])
      .slice()
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((e: any) => ({
        ...e,
        exercise_series: (e.program_template_series ?? []).slice().sort(
          (a: any, b: any) => a.series_number - b.series_number,
        ),
      })),
  }));

  const { data: clients } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('role', 'client')
    .eq('coach_id', user.id)
    .order('name');

  return (
    <>
      <header className="app-header">
        <div className="container inner">
          <Link href="/dashboard" className="brand">
            <Logo />
          </Link>
          <Link href="/programs" className="btn btn-ghost" style={{ padding: '10px 18px' }}>
            ← PROGRAMAS
          </Link>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 34, paddingBottom: 40 }}>
        <span className="label accent">Editar programa</span>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <EditableName templateId={id} initialName={template.name} />
            <div style={{ marginTop: 8 }}>
              <EditableDuration templateId={id} initialWeeks={(template as any).duration_weeks ?? null} />
            </div>
          </div>
          <AssignTemplateToClients
            templateId={id}
            clients={(clients ?? []) as { id: string; name: string; email: string }[]}
          />
        </div>

        <TemplateEditor templateId={id} initialDays={planDays} />
      </main>
    </>
  );
}
