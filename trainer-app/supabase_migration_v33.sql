-- v33 — la ficha del cliente en el panel: notas privadas del coach y fecha
-- de próxima revisión del plan. Primer paso del camino Traineeks decidido
-- el 06-09-2026: el coach anota lo que quiera de su alumno (solo él lo ve)
-- y agenda cuándo le toca revisar el plan.

create table if not exists public.client_files (
  client_id uuid primary key references public.users(id) on delete cascade,
  coach_id uuid not null references public.users(id) on delete cascade,
  notes text not null default '',
  next_review_at date,
  updated_at timestamptz not null default now()
);

alter table public.client_files enable row level security;

-- Solo el coach del cliente, y nadie más: el alumno NO ve estas notas
-- (son la libreta privada del coach), y otro coach tampoco.
create policy files_coach_select on public.client_files
  for select to authenticated
  using (exists (select 1 from public.users cli
                  where cli.id = client_id and cli.coach_id = auth.uid()));

create policy files_coach_insert on public.client_files
  for insert to authenticated
  with check (coach_id = auth.uid()
    and exists (select 1 from public.users cli
                 where cli.id = client_id and cli.coach_id = auth.uid()));

create policy files_coach_update on public.client_files
  for update to authenticated
  using (exists (select 1 from public.users cli
                  where cli.id = client_id and cli.coach_id = auth.uid()))
  with check (coach_id = auth.uid());
