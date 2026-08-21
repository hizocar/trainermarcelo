-- v25 — el coach ofrece servicios (varios), no una modalidad (una).
--
-- 'presencial | online | ambas' se queda corto: un coach entrena a domicilio,
-- en gimnasio, online, o solo planifica — y casi siempre más de una. El lado
-- del CLIENTE no cambia: en /busco-coach se sigue preguntando presencial u
-- online, que es como piensa quien busca.
--
--   users.services text[]  ⊆  {domicilio, gimnasio, online, planifica}
--
-- Transición sin romper producción: la vista public_coaches conserva
-- `modality` como columna CALCULADA desde services mientras el código viejo
-- (que hoy la lee en /coaches y /coach/[slug]) siga desplegado. Se limpia en
-- la próxima migración que toque la vista.
--
-- NO es reaplicable tal cual (drop de la firma vieja de update_my_profile);
-- reintentarla es seguro: todos los drop usan `if exists`.

-- ---------- La columna nueva, migrando lo que había ----------

alter table public.users
  add column if not exists services text[] not null default '{}'::text[]
    check (services <@ array['domicilio','gimnasio','online','planifica']::text[]);

update public.users set services =
  case modality
    when 'presencial' then array['gimnasio']
    when 'online'     then array['online']
    when 'ambas'      then array['gimnasio','online']
    else '{}'::text[]
  end
where role = 'coach' and modality is not null and services = '{}';

-- ---------- update_my_profile: recibe el arreglo ----------

drop function if exists public.update_my_profile(text,text,text[],text[],text,boolean);

create or replace function public.update_my_profile(
  p_bio text, p_instagram text, p_specialties text[],
  p_comunas text[], p_services text[], p_accepting boolean
) returns void language plpgsql security definer set search_path = public as $$
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

  -- La lista de columnas es la autorización: slug, marketplace_status,
  -- is_platform_admin, role y gym_id no están, y por eso el coach no puede
  -- tocarlos por acá.
  update public.users
     set bio = nullif(trim(coalesce(p_bio, '')), ''),
         instagram = nullif(trim(coalesce(p_instagram, '')), ''),
         specialties = coalesce(p_specialties, '{}'),
         comunas = coalesce(p_comunas, '{}'),
         services = coalesce(p_services, '{}'),
         accepting_clients = coalesce(p_accepting, true)
   where id = auth.uid() and role = 'coach';

  if not found then
    raise exception 'perfil no encontrado' using errcode = 'P0002';
  end if;
end;
$$;

-- Lección de la v20: los default privileges de Supabase le dan EXECUTE a anon
-- explícitamente sobre toda función nueva, y `from public` no toca esa
-- concesión. Acá anon NO debe poder llamarla.
revoke execute on function public.update_my_profile(text,text,text[],text[],text[],boolean) from public, anon;
grant execute on function public.update_my_profile(text,text,text[],text[],text[],boolean)
  to authenticated;

-- ---------- public_coaches: services de verdad, modality de compatibilidad ----------

-- create or replace no puede cambiar columnas: se recrea. El grant se rehace
-- porque el drop se lo lleva.
drop view if exists public.public_coaches;

create view public.public_coaches
with (security_invoker = false) as
select u.slug, u.name, u.avatar_url, u.bio, u.instagram,
       u.specialties, u.comunas, u.services,
       -- SOLO para el código ya desplegado que aún lee modality; se elimina
       -- en la próxima migración que toque esta vista.
       case
         when u.services @> array['online']
              and (u.services && array['gimnasio','domicilio']) then 'ambas'
         when u.services @> array['online'] then 'online'
         else 'presencial'
       end as modality,
       u.accepting_clients
from public.users u
where u.role = 'coach'
  and u.marketplace_status = 'approved'
  and u.slug is not null;

grant select on public.public_coaches to anon, authenticated;
