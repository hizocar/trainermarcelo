import { notFound } from 'next/navigation';
import { requireCoach } from '@/lib/guard';
import type { PlanDay } from '@/lib/types';
import TemplateEditor from './TemplateEditor';
import AssignTemplateToClients from './AssignTemplateToClients';
import EditableName from './EditableName';
import EditableTags from './EditableTags';
import TemplateWeekManager, { type TplWeek } from './TemplateWeekManager';
import SellProgram from './SellProgram';

export const dynamic = 'force-dynamic';

export default async function ProgramEditorPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ week?: string }> }) {
  const { id } = await params;
  const { week: requestedWeekId } = await searchParams;
  const { supabase, userId } = await requireCoach();

  const { data: template } = await supabase
    .from('program_templates')
    .select('id, name, coach_id, duration_weeks, level, focus, for_sale, price_clp, description')
    .eq('id', id)
    .maybeSingle();

  if (!template || template.coach_id !== userId) notFound();

  // las semanas del programa (v39): la elegida en la URL, o la primera
  const { data: weeksData } = await supabase
    .from('program_template_weeks')
    .select('id, week_number, name')
    .eq('template_id', id)
    .order('week_number');
  const tplWeeks = (weeksData ?? []) as TplWeek[];
  const selectedWeek = tplWeeks.find(w => w.id === requestedWeekId) ?? tplWeeks[0] ?? null;

  const { data: days } = await supabase
    .from('program_template_days')
    .select(`
      id, template_id, day_number, name, week_day,
      program_template_exercises (
        id, day_id, name, name_en, library_id, muscle_group, superseries_group,
        reps_objective, unit, ref_weight, order_index, rest_seconds, target_rir, tempo, notes, video_url,
        program_template_series ( id, exercise_id, series_number )
      )
    `)
    .eq('template_id', id)
    .eq('template_week_id', selectedWeek?.id ?? '00000000-0000-0000-0000-000000000000')
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
    .eq('coach_id', userId)
    .order('name');

  return (
    <>

      <main className="container" style={{ paddingTop: 34, paddingBottom: 40 }}>
        <span className="label accent">Editar programa</span>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <EditableName templateId={id} initialName={template.name} />
            <div style={{ marginTop: 8 }}>
              <EditableTags
                templateId={id}
                initialLevel={(template as any).level ?? null}
                initialFocus={(template as any).focus ?? null}
              />
            </div>
          </div>
          <AssignTemplateToClients
            templateId={id}
            clients={(clients ?? []) as { id: string; name: string; email: string }[]}
          />
        </div>

        <SellProgram
          templateId={id}
          initialForSale={(template as any).for_sale ?? false}
          initialPrice={(template as any).price_clp ?? null}
          initialDescription={(template as any).description ?? null}
        />

        <TemplateWeekManager templateId={id} weeks={tplWeeks} selectedWeekId={selectedWeek?.id ?? null} />

        {selectedWeek ? (
          <TemplateEditor key={selectedWeek.id} templateId={id} templateWeekId={selectedWeek.id} initialDays={planDays} />
        ) : (
          <p className="muted" style={{ marginTop: 20 }}>Creando la Semana 1…</p>
        )}
      </main>
    </>
  );
}
