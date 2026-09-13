-- v40 — quitar un programa lo ARCHIVA, no lo borra. Nació de un incidente
-- real (feedback de Yharel, punto 6): duplicó, le dio "quitar" y perdió su
-- trabajo — el borrado era en cascada (semanas, días, ejercicios, series).
-- Archivado: desaparece del catálogo, del store y de la app, pero un admin
-- puede devolverlo con un UPDATE.

alter table public.program_templates
  add column if not exists archived boolean not null default false;

-- los archivados no se venden
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
   and pt.archived = false
   and pt.price_clp is not null
   and u.role = 'coach'
   and u.marketplace_status = 'approved'
   and u.slug is not null;

grant select on public.public_coach_programs to anon, authenticated;
