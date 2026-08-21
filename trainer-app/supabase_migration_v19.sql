-- v19 — Marketplace: bolsa de solicitudes de alumnos.
-- Diseño: docs/superpowers/specs/2026-08-20-marketplace-web-design.md
--
-- Regla que ordena todo este archivo: coach_requests guarda un teléfono de una
-- persona que no tiene cuenta y no aceptó ningún término más allá de publicar su
-- solicitud. RLS es por fila, así que la tabla NO tiene política de lectura: se
-- lee por la vista open_requests, que no incluye la columna, y el número sale
-- solo por apply_to_request() cuando ya hay postulación registrada.

-- ---------- Tablas ----------

create table if not exists public.coach_requests (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  whatsapp          text not null,
  comuna            text not null,
  modality          text not null check (modality in ('presencial','online','ambas')),
  goal              text not null,
  availability      text,
  status            text not null default 'open'
                    check (status in ('open','matched','closed','expired')),
  -- set null: sin esto, borrar un coach que tomó una solicitud falla con un
  -- error de clave foránea. La solicitud ya está cerrada; quién la tomó es
  -- historia, no una referencia que valga bloquear un delete.
  matched_coach_id  uuid references public.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null default now() + interval '21 days'
);

create index if not exists coach_requests_abiertas
  on public.coach_requests (status, created_at desc);
create index if not exists coach_requests_whatsapp
  on public.coach_requests (whatsapp);

create table if not exists public.request_applications (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.coach_requests(id) on delete cascade,
  coach_id    uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (request_id, coach_id)
);

alter table public.coach_requests     enable row level security;
alter table public.request_applications enable row level security;
-- A propósito sin políticas: ni select, ni insert, ni update para nadie con la
-- ANON_KEY. Todo entra por las funciones security definer de más abajo.

-- ---------- Columnas nuevas ----------

alter table public.users
  add column if not exists marketplace_status text
      check (marketplace_status in ('pending','approved','rejected')),
  add column if not exists is_platform_admin boolean not null default false,
  add column if not exists slug text unique,
  add column if not exists bio text,
  add column if not exists instagram text,
  add column if not exists specialties text[],
  add column if not exists comunas text[],
  add column if not exists modality text
      check (modality in ('presencial','online','ambas')),
  add column if not exists accepting_clients boolean not null default true;

-- marketplace_status nulo = coach que ya existía, que llegó pagando: aprobado.
-- Solo el registro gratis lo deja en 'pending'.

alter table public.gyms
  add column if not exists free_month_used    boolean not null default false,
  add column if not exists free_month_ends_at timestamptz;

-- ---------- Ayudantes ----------

create or replace function public.is_marketplace_coach(p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users u
    where u.id = p_uid
      and u.role = 'coach'
      and (u.marketplace_status is null or u.marketplace_status = 'approved')
  );
$$;

revoke execute on function public.is_marketplace_coach(uuid) from public, anon;

create or replace function public.coach_sub_status(p_uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select g.subscription_status
  from public.users u join public.gyms g on g.id = u.gym_id
  where u.id = p_uid;
$$;

revoke execute on function public.coach_sub_status(uuid) from public, anon;

-- ---------- Vistas ----------

-- Sin security_invoker: la vista necesita leer una tabla que no tiene política
-- de lectura para nadie. Eso significa que su WHERE *es* la autorización, no un
-- filtro de conveniencia — por eso comprueba acá mismo que el coach esté
-- aprobado, en vez de confiar en que quien la consulta ya lo estaba.
create or replace view public.open_requests
with (security_invoker = false) as
select
  r.id, r.comuna, r.modality, r.goal, r.availability, r.created_at,
  greatest(0, 3 - (select count(*) from public.request_applications a
                   where a.request_id = r.id))::int as slots_left,
  exists (select 1 from public.request_applications a
          where a.request_id = r.id and a.coach_id = auth.uid()) as already_applied
from public.coach_requests r
where r.status = 'open'
  and r.expires_at > now()
  and public.is_marketplace_coach(auth.uid())
  and (
    coalesce(public.coach_sub_status(auth.uid()), '') in ('active','trialing')
    or r.created_at <= now() - interval '12 hours'
  )
  and (
    (select count(*) from public.request_applications a where a.request_id = r.id) < 3
    or exists (select 1 from public.request_applications a
               where a.request_id = r.id and a.coach_id = auth.uid())
  );

grant select on public.open_requests to authenticated;

-- El coach necesita volver a ver el número después de postularse; guardarlo
-- duplicado en request_applications sería un segundo lugar donde vive un dato
-- personal. Se lee por join, acotado a sus propias postulaciones.
create or replace view public.my_applications
with (security_invoker = false) as
select
  r.id as request_id, r.name, r.whatsapp, r.comuna, r.modality, r.goal,
  r.availability, a.created_at as applied_at, r.status
from public.request_applications a
join public.coach_requests r on r.id = a.request_id
where a.coach_id = auth.uid();

grant select on public.my_applications to authenticated;

create or replace view public.pending_coaches
with (security_invoker = false) as
select u.id, u.name, u.email, u.instagram, u.created_at
from public.users u
where u.marketplace_status = 'pending'
  and exists (select 1 from public.users me
              where me.id = auth.uid() and me.is_platform_admin);

grant select on public.pending_coaches to authenticated;

-- ---------- Funciones ----------

create or replace function public.create_request(
  p_name text, p_whatsapp text, p_comuna text, p_modality text,
  p_goal text, p_availability text, p_trap text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_recientes int;
begin
  -- Honeypot: un campo que ningún humano ve. Si viene lleno, es un bot.
  if coalesce(p_trap, '') <> '' then
    raise exception 'solicitud inválida' using errcode = 'P0001';
  end if;

  -- El cliente ya normaliza, pero el cliente no es de fiar.
  if p_whatsapp !~ '^\+569[0-9]{8}$' then
    raise exception 'teléfono inválido' using errcode = 'P0001';
  end if;

  if length(trim(coalesce(p_name, ''))) < 2
     or length(trim(coalesce(p_comuna, ''))) < 2
     or length(trim(coalesce(p_goal, ''))) < 10 then
    raise exception 'solicitud incompleta' using errcode = 'P0001';
  end if;

  if length(p_goal) > 600 or length(coalesce(p_availability, '')) > 300 then
    raise exception 'texto demasiado largo' using errcode = 'P0001';
  end if;

  if p_modality not in ('presencial','online','ambas') then
    raise exception 'modalidad inválida' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.coach_requests r
             where r.whatsapp = p_whatsapp and r.status = 'open'
               and r.expires_at > now()) then
    raise exception 'ya tienes una solicitud abierta' using errcode = 'P0005';
  end if;

  select count(*) into v_recientes from public.coach_requests r
   where r.whatsapp = p_whatsapp and r.created_at > now() - interval '24 hours';
  if v_recientes >= 3 then
    raise exception 'demasiadas solicitudes' using errcode = 'P0006';
  end if;

  insert into public.coach_requests (name, whatsapp, comuna, modality, goal, availability)
  values (trim(p_name), p_whatsapp, trim(p_comuna), p_modality, trim(p_goal),
          nullif(trim(coalesce(p_availability, '')), ''))
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.create_request(text,text,text,text,text,text,text) from public;
grant execute on function public.create_request(text,text,text,text,text,text,text)
  to anon, authenticated;

create or replace function public.apply_to_request(p_request_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_coach uuid := auth.uid();
  v_req   public.coach_requests%rowtype;
  v_count int;
begin
  if v_coach is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;

  if not public.is_marketplace_coach(v_coach) then
    raise exception 'coach no aprobado' using errcode = '42501';
  end if;

  -- for update serializa dos postulaciones simultáneas al mismo pedido: sin
  -- esto, dos coaches pueden contar 2 al mismo tiempo y quedar 4 postulados.
  select r.* into v_req from public.coach_requests r
   where r.id = p_request_id for update;

  if not found or v_req.status <> 'open' or v_req.expires_at <= now() then
    raise exception 'solicitud no disponible' using errcode = 'P0002';
  end if;

  if coalesce(public.coach_sub_status(v_coach), '') not in ('active','trialing')
     and v_req.created_at > now() - interval '12 hours' then
    raise exception 'solicitud no disponible' using errcode = 'P0003';
  end if;

  select count(*) into v_count from public.request_applications a
   where a.request_id = p_request_id;

  if v_count >= 3 and not exists (
       select 1 from public.request_applications a
        where a.request_id = p_request_id and a.coach_id = v_coach) then
    raise exception 'sin cupo' using errcode = 'P0004';
  end if;

  insert into public.request_applications (request_id, coach_id)
  values (p_request_id, v_coach)
  on conflict (request_id, coach_id) do nothing;

  return v_req.whatsapp;
end;
$$;

revoke execute on function public.apply_to_request(uuid) from public, anon;
grant execute on function public.apply_to_request(uuid) to authenticated;

create or replace function public.claim_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_coach uuid := auth.uid();
  v_gym   uuid;
begin
  if not exists (select 1 from public.request_applications a
                 where a.request_id = p_request_id and a.coach_id = v_coach) then
    raise exception 'no te postulaste a esta solicitud' using errcode = '42501';
  end if;

  update public.coach_requests
     set status = 'matched', matched_coach_id = v_coach
   where id = p_request_id and status = 'open';

  if not found then
    raise exception 'solicitud no disponible' using errcode = 'P0002';
  end if;

  select u.gym_id into v_gym from public.users u where u.id = v_coach;

  -- El mes de regalo: una sola vez por gimnasio, no por alumno, y SOLO para el
  -- gimnasio que está de verdad en el marketplace. free_month_used = false es
  -- el valor por defecto de todos los gimnasios que ya existen: acotado solo
  -- por ahí, un coach de plan Solo o Growth que paga por Flow y marca "Lo
  -- tomé" se llevaba free_month_ends_at y un mes después quedaba encerrado.
  -- El estado propio 'free_month' —en vez de reutilizar 'active'— hace que
  -- cualquier pago real que ponga 'active' gane por construcción, sin depender
  -- de que el webhook de Flow, que vive fuera de este repositorio, limpie la
  -- fecha. Y no toca a un gimnasio en past_due: la solicitud se cierra igual,
  -- solo no hay regalo.
  update public.gyms
     set free_month_used = true,
         subscription_status = 'free_month',
         free_month_ends_at = now() + interval '1 month'
   where id = v_gym
     and free_month_used = false
     and subscription_status = 'marketplace';
end;
$$;

revoke execute on function public.claim_request(uuid) from public, anon;
grant execute on function public.claim_request(uuid) to authenticated;

create or replace function public.approve_coach(p_coach_id uuid, p_slug text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_slug text := p_slug;
  v_n int := 1;
begin
  if not exists (select 1 from public.users me
                 where me.id = auth.uid() and me.is_platform_admin) then
    raise exception 'no autorizado' using errcode = '42501';
  end if;

  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'slug inválido' using errcode = 'P0001';
  end if;

  -- El unique de la columna es quien decide; esto solo busca el primer sufijo
  -- libre. Dos aprobaciones simultáneas con el mismo nombre: una falla y se
  -- reintenta, en vez de quedar las dos con el mismo slug.
  while exists (select 1 from public.users u
                where u.slug = v_slug and u.id <> p_coach_id) loop
    v_n := v_n + 1;
    v_slug := p_slug || '-' || v_n;
  end loop;

  update public.users
     set marketplace_status = 'approved', slug = v_slug
   where id = p_coach_id and role = 'coach';

  -- Aprobar un id que no es coach no puede "tener éxito" sin hacer nada.
  -- Mismo criterio que update_my_profile en v20 y que claim_request acá.
  if not found then
    raise exception 'coach no encontrado' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.approve_coach(uuid, text) from public, anon;
grant execute on function public.approve_coach(uuid, text) to authenticated;

create or replace function public.reject_coach(p_coach_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.users me
                 where me.id = auth.uid() and me.is_platform_admin) then
    raise exception 'no autorizado' using errcode = '42501';
  end if;

  update public.users set marketplace_status = 'rejected' where id = p_coach_id;
end;
$$;

revoke execute on function public.reject_coach(uuid) from public, anon;
grant execute on function public.reject_coach(uuid) to authenticated;
