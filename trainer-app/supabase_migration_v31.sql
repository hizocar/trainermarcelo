-- v31 — agenda (citas coach↔alumno) y cuestionarios (ficha PAR-Q).
--
-- AGENDA: el coach agenda sesiones con sus alumnos; el alumno las ve en su
-- app y puede cancelar HASTA 2 HORAS ANTES. La política de cancelación vive
-- acá (cancelar_cita), no en la interfaz: una app vieja no puede saltársela.
--
-- CUESTIONARIOS: parte con la ficha de ingreso (PAR-Q). El alumno responde
-- una vez (y puede corregirla); la lee él y su coach. `answers` es jsonb:
-- los formularios personalizados del futuro caben sin migrar.
--
-- Reaplicable: create table if not exists + drop policy if exists.

-- ---------- Citas ----------

create table if not exists public.appointments (
  id           uuid primary key default gen_random_uuid(),
  coach_id     uuid not null references public.users(id),
  client_id    uuid not null references public.users(id),
  starts_at    timestamptz not null,
  duration_min int not null default 60 check (duration_min between 15 and 480),
  modality     text not null default 'presencial' check (modality in ('presencial','online')),
  status       text not null default 'agendada'
               check (status in ('agendada','cancelada_coach','cancelada_cliente')),
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists citas_por_coach  on public.appointments (coach_id, starts_at);
create index if not exists citas_por_alumno on public.appointments (client_id, starts_at);

alter table public.appointments enable row level security;

-- El coach maneja SU agenda, y solo con SUS alumnos actuales.
drop policy if exists "citas_coach" on public.appointments;
create policy "citas_coach" on public.appointments for all
  using (coach_id = auth.uid())
  with check (
    coach_id = auth.uid()
    and exists (select 1 from public.users c
                 where c.id = client_id and c.coach_id = auth.uid())
  );

-- El alumno VE sus citas; cancelar va por la función, que impone la política.
drop policy if exists "citas_alumno_lectura" on public.appointments;
create policy "citas_alumno_lectura" on public.appointments
  for select using (client_id = auth.uid());

create or replace function public.cancelar_cita(p_cita_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cita public.appointments%rowtype;
begin
  select * into v_cita from public.appointments
   where id = p_cita_id and client_id = auth.uid() for update;
  if not found then
    raise exception 'cita no encontrada' using errcode = 'P0002';
  end if;
  if v_cita.status <> 'agendada' then
    raise exception 'la cita ya no está agendada' using errcode = 'P0001';
  end if;
  -- la política: hasta 2 horas antes. Después de eso, se habla con el coach.
  if v_cita.starts_at <= now() + interval '2 hours' then
    raise exception 'muy encima de la hora: contacta a tu coach' using errcode = 'P0003';
  end if;
  update public.appointments set status = 'cancelada_cliente' where id = p_cita_id;
end;
$$;

revoke execute on function public.cancelar_cita(uuid) from public, anon;
grant execute on function public.cancelar_cita(uuid) to authenticated;

-- ---------- Cuestionarios ----------

create table if not exists public.client_forms (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.users(id),
  kind       text not null default 'parq' check (kind in ('parq')),
  answers    jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, kind)
);

alter table public.client_forms enable row level security;

drop policy if exists "forms_alumno" on public.client_forms;
create policy "forms_alumno" on public.client_forms for all
  using (client_id = auth.uid())
  with check (client_id = auth.uid());

drop policy if exists "forms_coach_lectura" on public.client_forms;
create policy "forms_coach_lectura" on public.client_forms
  for select using (
    exists (select 1 from public.users c
             where c.id = client_id and c.coach_id = auth.uid())
  );
