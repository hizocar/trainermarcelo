-- v35 — el store de rutinas, fase 1 (camino Traineeks, paso 4; primer
-- producto real del "marketplace de productos" del pitch).
--
-- Sin pasarela a propósito: el interesado deja su solicitud, el coach cierra
-- el pago como ya opera el rubro (transferencia) y entrega con las piezas que
-- existen (crear cliente + asignar programa). Flow y la comisión llegan en la
-- fase 2, cuando el store demuestre demanda — no antes.

-- 1) el programa se puede poner a la venta, con precio en CLP
alter table public.program_templates
  add column if not exists for_sale boolean not null default false,
  add column if not exists price_clp integer
    check (price_clp is null or (price_clp >= 1000 and price_clp <= 1000000));

alter table public.program_templates
  drop constraint if exists program_templates_venta_con_precio;
alter table public.program_templates
  add constraint program_templates_venta_con_precio
    check (not for_sale or price_clp is not null);

-- 2) solicitudes de compra
create table if not exists public.program_requests (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.program_templates(id) on delete cascade,
  coach_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  email text not null,
  message text,
  status text not null default 'nueva' check (status in ('nueva', 'atendida')),
  created_at timestamptz not null default now()
);

alter table public.program_requests enable row level security;

-- solo el coach dueño las ve y las marca atendidas; se insertan por RPC
create policy prog_req_coach_select on public.program_requests
  for select to authenticated using (coach_id = auth.uid());
create policy prog_req_coach_update on public.program_requests
  for update to authenticated
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- 3) la vitrina pública: programas a la venta de coaches aprobados del
-- marketplace (misma condición que public_coaches)
create or replace view public.public_coach_programs as
select pt.id,
       pt.name,
       pt.level,
       pt.focus,
       pt.description,
       pt.price_clp,
       pt.duration_weeks,
       (select count(*) from public.program_template_days d where d.template_id = pt.id) as days,
       u.slug as coach_slug
  from public.program_templates pt
  join public.users u on u.id = pt.coach_id
 where pt.for_sale
   and pt.price_clp is not null
   and u.role = 'coach'
   and u.marketplace_status = 'approved'
   and u.slug is not null;

grant select on public.public_coach_programs to anon, authenticated;

-- 4) dejar la solicitud (anónimo: es el público del marketplace)
create or replace function public.solicitar_programa(
  p_template uuid, p_name text, p_email text, p_message text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_tpl public.program_templates%rowtype;
begin
  if p_name is null or trim(p_name) = ''
     or p_email is null or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'nombre y correo válidos son obligatorios' using errcode = 'P0001';
  end if;

  select * into v_tpl from public.program_templates where id = p_template and for_sale;
  if not found then
    raise exception 'ese programa no está a la venta' using errcode = 'P0002';
  end if;

  insert into public.program_requests (template_id, coach_id, name, email, message)
  values (v_tpl.id, v_tpl.coach_id, trim(p_name), lower(trim(p_email)),
          nullif(trim(coalesce(p_message, '')), ''));
end;
$$;

revoke execute on function public.solicitar_programa(uuid, text, text, text) from public;
grant execute on function public.solicitar_programa(uuid, text, text, text) to anon, authenticated;
