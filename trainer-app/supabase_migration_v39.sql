-- v39 — programas de VARIAS semanas (pedido de Sebastián tras ver funcionar
-- la asignación por semanas): una plantilla deja de ser una semana implícita
-- y pasa a tener sus semanas explícitas, como los planes desde la v17. Al
-- asignar, la semana N del programa cae en la semana calendario actual+N-1
-- del alumno, y la última se repite hacia adelante.

create table if not exists public.program_template_weeks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.program_templates(id) on delete cascade,
  week_number int not null,
  name text not null default 'Semana',
  is_deload boolean not null default false,
  created_at timestamptz not null default now(),
  unique (template_id, week_number)
);

alter table public.program_template_weeks enable row level security;

-- mismo dueño que el resto de program_template_*: el coach de la plantilla
create policy tpl_weeks_coach on public.program_template_weeks
  for all to authenticated
  using (template_id in (select id from public.program_templates where coach_id = auth.uid()))
  with check (template_id in (select id from public.program_templates where coach_id = auth.uid()));

alter table public.program_template_days
  add column if not exists template_week_id uuid
    references public.program_template_weeks(id) on delete cascade;

-- backfill: los días existentes pasan a ser la Semana 1 de su plantilla
insert into public.program_template_weeks (template_id, week_number, name)
select distinct d.template_id, 1, 'Semana 1'
  from public.program_template_days d
on conflict (template_id, week_number) do nothing;

update public.program_template_days d
   set template_week_id = w.id
  from public.program_template_weeks w
 where w.template_id = d.template_id
   and w.week_number = 1
   and d.template_week_id is null;

-- la vitrina informa la cantidad REAL de semanas (si el programa las tiene)
-- y los días POR SEMANA (los de la semana 1), no la suma de todas
create or replace view public.public_coach_programs as
select pt.id,
       pt.name,
       pt.level,
       pt.focus,
       pt.description,
       pt.price_clp,
       coalesce(
         nullif((select count(*)::int from public.program_template_weeks w
                  where w.template_id = pt.id), 0),
         pt.duration_weeks
       ) as duration_weeks,
       (select count(*) from public.program_template_days d
          join public.program_template_weeks w on w.id = d.template_week_id
         where w.template_id = pt.id and w.week_number = 1) as days,
       u.slug as coach_slug
  from public.program_templates pt
  join public.users u on u.id = pt.coach_id
 where pt.for_sale
   and pt.price_clp is not null
   and u.role = 'coach'
   and u.marketplace_status = 'approved'
   and u.slug is not null;

grant select on public.public_coach_programs to anon, authenticated;
