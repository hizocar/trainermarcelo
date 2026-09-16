import { notFound } from 'next/navigation';
import { requireCoach } from '@/lib/guard';
import type { PlanDay } from '@/lib/types';
import TemplateEditor, { type TplWeekLite } from './TemplateEditor';
import AssignTemplateToClients from './AssignTemplateToClients';
import EditableName from './EditableName';
import EditableTags from './EditableTags';
import SellProgram from './SellProgram';

export const dynamic = 'force-dynamic';

export default async function ProgramEditorPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await requireCoach();

  const { data: template } = await supabase
    .from('program_templates')
    .select('id, name, coach_id, duration_weeks, level, focus, for_sale, price_clp, description')
    .eq('id', id)
    .maybeSingle();

  if (!template || template.coach_id !== userId) notFound();

  // TODAS las semanas y TODOS los días: el editor es un gran calendario
  // (semanas apiladas), ya no hay semana "seleccionada" por URL.
  const { data: weeksData } = await supabase
    .from('program_template_weeks')
    .select('id, week_number, name')
    .eq('template_id', id)
    .order('week_number');
  const tplWeeks: TplWeekLite[] = (weeksData ?? []).map((w) => ({ id: w.id, name: w.name }));

  const { data: days } = await supabase
    .from('program_template_days')
    .select(`
      id, template_id, template_week_id, day_number, name, week_day,
      program_template_exercises (
        id, day_id, name, name_en, library_id, muscle_group, superseries_group,
        reps_objective, unit, ref_weight, order_index, rest_seconds, target_rir, target_pct_1rm, target_rpe, tempo, notes, video_url, volume_type, intensity_types,
        program_template_series ( id, exercise_id, series_number, reps_objective, rest_seconds, tempo, target_rir, target_rpe, target_pct_1rm, ref_weight, set_type )
      )
    `)
    .eq('template_id', id)
    .order('day_number');

  // adaptar al shape de PlanDay que ya usa el editor (mismos nombres de campo,
  // solo cambia exercise_series ← program_template_series y day_id ← program_template_exercises.day_id)
  const planDays: PlanDay[] = (days ?? []).map((d: any) => ({
    id: d.id,
    plan_id: d.template_id,
    template_week_id: d.template_week_id,
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
            semanasPrograma={tplWeeks.length}
          />
        </div>

        <SellProgram
          templateId={id}
          initialForSale={(template as any).for_sale ?? false}
          initialPrice={(template as any).price_clp ?? null}
          initialDescription={(template as any).description ?? null}
        />

        <TemplateEditor templateId={id} weeks={tplWeeks} initialDays={planDays} />
      </main>
    </>
  );
}
