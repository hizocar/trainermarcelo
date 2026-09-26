-- v49: registro propio (proyecto 1 del nuevo modelo).
-- Diseño: docs/superpowers/specs/2026-09-26-registro-propio-design.md
--
-- · Toda cuenta nace SIN COMPLETAR y como alumno. handle_new_user deja de leer
--   el rol desde los metadatos del registro (los manda el cliente: cualquiera
--   podía pedirse "coach").
-- · completar_registro(rol, nombre) fija rol y nombre UNA sola vez. Si es coach,
--   crea en la misma transacción su espacio con la prueba de 3 meses y el
--   límite de 5 alumnos.
-- · Aparecer en el buscador (decisión del coach: en_buscador) y estar aprobado
--   (decisión de Sebastián: marketplace_status) pasan a ser datos distintos.
-- · perfil_coach_completo: UNA sola definición de "perfil completo", en la base.
-- · Coaches actuales: prueba desde el lanzamiento (26-sep-2026, Chile) → hasta
--   el 26-dic-2026, con límite de 5 alumnos. Hoy nadie supera 5 (máximo: 4).

begin;

-- ── users ──
alter table public.users
  add column if not exists registro_completo boolean not null default false,
  add column if not exists en_buscador boolean not null default false;

-- quienes ya existen tienen rol y nombre: no pasan por la pantalla obligatoria
update public.users set registro_completo = true;
-- los aprobados hoy están visibles: siguen visibles
update public.users set en_buscador = true where marketplace_status = 'approved';

alter table public.users
  add column if not exists perfil_coach_completo boolean generated always as (
    avatar_url is not null
    and btrim(coalesce(bio, '')) <> ''
    and coalesce(cardinality(specialties), 0) > 0
    and coalesce(cardinality(services), 0) > 0
    -- presencial (gimnasio o domicilio) exige al menos una comuna
    and (not (services && array['gimnasio', 'domicilio']::text[])
         or coalesce(cardinality(comunas), 0) > 0)
  ) stored;

-- ── gyms: la prueba y el límite ──
alter table public.gyms
  add column if not exists trial_ends_at timestamptz,
  add column if not exists alumnos_max integer
    check (alumnos_max is null or alumnos_max > 0);

comment on column public.gyms.alumnos_max is
  'Máximo de alumnos POR COACH mientras dure la prueba (5). NULL = sin límite. Lo hace cumplir la función que liga alumno y coach (proyecto 2).';

update public.gyms
   set subscription_status = 'trialing',
       trial_ends_at = ('2026-09-26 00:00'::timestamp at time zone 'America/Santiago') + interval '3 months',
       alumnos_max = 5;

-- ── handle_new_user: el rol ya no viene del cliente ──
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Nace como alumno y SIN COMPLETAR: la pantalla obligatoria llama a
  -- completar_registro. El nombre, si el proveedor lo trae (Google: full_name;
  -- registro propio: name), queda de borrador; si no, el correo, que la
  -- pantalla obligatoria reemplaza.
  insert into public.users (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      new.email
    ),
    'client'::user_role
  );
  return new;
end;
$function$;

-- ── completar_registro ──
create or replace function public.completar_registro(p_rol text, p_nombre text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid    uuid := auth.uid();
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_hecho  boolean;
  v_gym    uuid;
begin
  if v_uid is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;

  -- for update: dos toques seguidos no crean dos gimnasios
  select registro_completo into v_hecho from public.users where id = v_uid for update;
  if not found then
    raise exception 'perfil no encontrado' using errcode = 'P0002';
  end if;
  if v_hecho then
    raise exception 'registro_ya_completo' using errcode = 'P0001';
  end if;

  if char_length(v_nombre) < 2 or char_length(v_nombre) > 60 then
    raise exception 'el nombre debe tener entre 2 y 60 caracteres' using errcode = 'P0001';
  end if;
  if v_nombre like '%@%' then
    raise exception 'usa tu nombre, no tu correo' using errcode = 'P0001';
  end if;

  if p_rol = 'alumno' then
    update public.users
       set role = 'client', name = v_nombre, registro_completo = true
     where id = v_uid;
    return 'client';

  elsif p_rol = 'coach' then
    insert into public.gyms (name, owner_id, plan_tier, coach_limit, subscription_status,
                             free_month_used, trial_ends_at, alumnos_max)
    values (v_nombre, v_uid, 'solo', 1, 'trialing', false, now() + interval '3 months', 5)
    returning id into v_gym;

    -- rol coach DIRECTO: la aprobación de Sebastián solo abre el buscador
    update public.users
       set role = 'coach', name = v_nombre, gym_id = v_gym, is_owner = true,
           registro_completo = true
     where id = v_uid;
    return 'coach';

  else
    raise exception 'rol_invalido' using errcode = 'P0001';
  end if;
end;
$function$;

revoke all on function public.completar_registro(text, text) from public, anon;
grant execute on function public.completar_registro(text, text) to authenticated;

-- ── actualizar_mi_nombre: para las cuentas cuyo nombre quedó como su correo ──
create or replace function public.actualizar_mi_nombre(p_nombre text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_nombre text := btrim(coalesce(p_nombre, ''));
begin
  if auth.uid() is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;
  if char_length(v_nombre) < 2 or char_length(v_nombre) > 60 then
    raise exception 'el nombre debe tener entre 2 y 60 caracteres' using errcode = 'P0001';
  end if;
  if v_nombre like '%@%' then
    raise exception 'usa tu nombre, no tu correo' using errcode = 'P0001';
  end if;
  update public.users set name = v_nombre where id = auth.uid();
end;
$function$;

revoke all on function public.actualizar_mi_nombre(text) from public, anon;
grant execute on function public.actualizar_mi_nombre(text) to authenticated;

-- ── update_my_profile: suma el interruptor del buscador ──
drop function if exists public.update_my_profile(text, text, text[], text[], text[], boolean, text);

create function public.update_my_profile(
  p_bio text, p_instagram text, p_specialties text[], p_comunas text[],
  p_services text[], p_accepting boolean, p_name text default null,
  p_en_buscador boolean default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
begin
  if auth.uid() is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;
  if not (coalesce(p_services, '{}') <@ array['domicilio','gimnasio','online','planifica']::text[]) then
    raise exception 'servicio inválido' using errcode = 'P0001';
  end if;
  if length(coalesce(p_bio, '')) > 800 then
    raise exception 'biografía demasiado larga' using errcode = 'P0001';
  end if;
  if coalesce(array_length(p_specialties, 1), 0) > 6
     or coalesce(array_length(p_comunas, 1), 0) > 10 then
    raise exception 'demasiadas etiquetas' using errcode = 'P0001';
  end if;
  if v_name is not null and (char_length(v_name) < 2 or char_length(v_name) > 60) then
    raise exception 'el nombre debe tener entre 2 y 60 caracteres' using errcode = 'P0001';
  end if;
  if v_name is not null and v_name like '%@%' then
    raise exception 'usa tu nombre, no tu correo' using errcode = 'P0001';
  end if;

  -- La lista de columnas es la autorización (slug, is_platform_admin, role y
  -- gym_id no están). marketplace_status: encender el buscador sin estar
  -- aprobado pide revisión; apagarlo NO toca la aprobación, así un coach
  -- aprobado que se oculta reaparece al volver a encenderlo sin pasar por la cola.
  update public.users
     set bio = nullif(trim(coalesce(p_bio, '')), ''),
         instagram = nullif(trim(coalesce(p_instagram, '')), ''),
         specialties = coalesce(p_specialties, '{}'),
         comunas = coalesce(p_comunas, '{}'),
         services = coalesce(p_services, '{}'),
         accepting_clients = coalesce(p_accepting, true),
         name = coalesce(v_name, name),
         en_buscador = coalesce(p_en_buscador, en_buscador),
         marketplace_status = case
           when p_en_buscador is true and coalesce(marketplace_status, '') <> 'approved' then 'pending'
           else marketplace_status
         end
   where id = auth.uid() and role = 'coach';

  if not found then
    raise exception 'perfil no encontrado' using errcode = 'P0002';
  end if;
end;
$function$;

revoke all on function public.update_my_profile(text, text, text[], text[], text[], boolean, text, boolean) from public, anon;
grant execute on function public.update_my_profile(text, text, text[], text[], text[], boolean, text, boolean) to authenticated;

-- ── el directorio muestra solo a quien lo decidió y está aprobado ──
create or replace view public.public_coaches as
select slug, name, avatar_url, bio, instagram, specialties, comunas, services,
       case
         when services @> array['online'] and services && array['gimnasio', 'domicilio'] then 'ambas'
         when services @> array['online'] then 'online'
         else 'presencial'
       end as modality,
       accepting_clients
  from public.users u
 where u.role = 'coach'::user_role
   and u.marketplace_status = 'approved'
   and u.en_buscador
   and u.slug is not null;

-- La vista es de solo lectura para el público: defensa extra (probado que hoy
-- no se podía escribir a través de ella, pero no dependemos de eso).
revoke insert, update, delete on public.public_coaches from anon, authenticated;

commit;
