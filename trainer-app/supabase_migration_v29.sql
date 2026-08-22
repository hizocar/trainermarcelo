-- v29 — registro de eventos de uso (app_events).
--
-- Cada cosa que el usuario hace en la app deja un evento con nombre y
-- propiedades. Van a NUESTRO Supabase y no a un tercero: los datos quedan
-- cruzables por SQL con el resto del negocio (sesiones, leads, planes), que
-- es exactamente lo que "decidir features con datos" necesita.
--
-- Sólo-inserción por diseño: el usuario escribe SUS eventos y nadie los
-- edita ni borra por la API (sin políticas de update/delete). Leer es del
-- administrador de la plataforma, vía la vista admin_eventos — el patrón de
-- pending_coaches/admin_funnel.
--
-- Reaplicable: create table if not exists + drop policy if exists.

create table if not exists public.app_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.users(id),
  name       text not null check (length(name) between 1 and 60),
  props      jsonb not null default '{}'::jsonb,
  -- cuándo OCURRIÓ en el teléfono (los lotes llegan tarde a propósito);
  -- created_at es cuándo llegó
  occurred_at timestamptz not null,
  created_at  timestamptz not null default now(),
  platform    text,
  app_version text
);

create index if not exists eventos_por_nombre on public.app_events (name, occurred_at desc);
create index if not exists eventos_por_usuario on public.app_events (user_id, occurred_at desc);

alter table public.app_events enable row level security;

drop policy if exists "eventos_insert" on public.app_events;
create policy "eventos_insert" on public.app_events
  for insert with check (user_id = auth.uid());
-- sin política de select/update/delete: por la API nadie lee ni reescribe

create or replace view public.admin_eventos
with (security_invoker = false) as
select e.id, e.user_id, u.role as user_role, e.name, e.props,
       e.occurred_at, e.platform, e.app_version
from public.app_events e
join public.users u on u.id = e.user_id
where exists (select 1 from public.users me
              where me.id = auth.uid() and me.is_platform_admin);

grant select on public.admin_eventos to authenticated;
