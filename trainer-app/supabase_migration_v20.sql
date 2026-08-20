-- v20 — Perfil público del coach.
-- Diseño: docs/superpowers/specs/2026-08-20-marketplace-web-design.md
--
-- La ficha pública se abre sin sesión (se comparte por Instagram), así que no
-- puede consultar public.users directamente: esa tabla tiene RLS y guarda
-- correos de alumnos. public_coaches es la vista que sí puede leerse en anon.
-- El coach tampoco edita su fila con un update directo: update_my_profile()
-- fija la lista de columnas editables, y por eso el coach no puede cambiar su
-- propio slug, marketplace_status, role, gym_id ni is_platform_admin.

-- ---------- Vista ----------

create or replace view public.public_coaches
with (security_invoker = false) as
select u.slug, u.name, u.avatar_url, u.bio, u.instagram,
       u.specialties, u.comunas, u.modality, u.accepting_clients
from public.users u
where u.role = 'coach'
  and u.marketplace_status = 'approved'
  and u.slug is not null;

-- anon también: la ficha se comparte por Instagram, se abre sin sesión.
grant select on public.public_coaches to anon, authenticated;

-- ---------- Función ----------

create or replace function public.update_my_profile(
  p_bio text, p_instagram text, p_specialties text[],
  p_comunas text[], p_modality text, p_accepting boolean
) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;

  if p_modality is not null and p_modality not in ('presencial','online','ambas') then
    raise exception 'modalidad inválida' using errcode = 'P0001';
  end if;

  if length(coalesce(p_bio, '')) > 800 then
    raise exception 'biografía demasiado larga' using errcode = 'P0001';
  end if;

  if coalesce(array_length(p_specialties, 1), 0) > 6
     or coalesce(array_length(p_comunas, 1), 0) > 10 then
    raise exception 'demasiadas etiquetas' using errcode = 'P0001';
  end if;

  -- La lista de columnas es la autorización: slug, marketplace_status,
  -- is_platform_admin, role y gym_id no están, y por eso el coach no puede
  -- aprobarse a sí mismo ni robarse la URL de otro.
  update public.users
     set bio = nullif(trim(coalesce(p_bio, '')), ''),
         instagram = nullif(trim(replace(coalesce(p_instagram, ''), '@', '')), ''),
         specialties = p_specialties,
         comunas = p_comunas,
         modality = p_modality,
         accepting_clients = coalesce(p_accepting, true)
   where id = auth.uid() and role = 'coach';

  -- Si quien llama está autenticado pero no es coach, el where no afecta
  -- ninguna fila y sin este chequeo la función "tendría éxito" sin cambiar
  -- nada. Falla explícito, como claim_request con su `if not found`.
  if not found then
    raise exception 'no autorizado' using errcode = '42501';
  end if;
end;
$$;

-- EXECUTE sobre una función nueva se otorga a PUBLIC por defecto, y un grant
-- a authenticated suma, no reemplaza: sin este revoke, cualquier anon podría
-- llamarla (fallaría por el check de auth.uid(), pero la superficie queda
-- abierta sin necesidad).
revoke execute on function public.update_my_profile(text,text,text[],text[],text,boolean) from public;
grant execute on function public.update_my_profile(text,text,text[],text[],text,boolean)
  to authenticated;

-- ---------- Cifras del canal (cola de aprobación) ----------

-- coach_requests y request_applications no tienen política de lectura para
-- nadie —eso es lo que protege el teléfono del alumno—, así que un
-- count: 'exact' del cliente sobre esas tablas siempre da cero. Esta vista
-- es la única forma de mostrar las cifras, y por eso su WHERE es la
-- autorización, igual que en pending_coaches: sin sesión de admin, ninguna
-- fila sale de acá.
create or replace view public.marketplace_stats
with (security_invoker = false) as
select
  (select count(*) from public.coach_requests)                         as solicitudes,
  (select count(*) from public.request_applications)                   as postulaciones,
  (select count(*) from public.coach_requests where status = 'matched') as tomadas
where exists (select 1 from public.users me
              where me.id = auth.uid() and me.is_platform_admin);

grant select on public.marketplace_stats to authenticated;
