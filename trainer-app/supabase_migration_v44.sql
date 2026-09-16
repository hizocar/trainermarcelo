-- v44: el perfil del coach (1) permite elegir el nombre visible y (2) al
-- guardarlo entra a la cola de aprobación del marketplace.
--
-- Bug real (Yharel): guardó su perfil y nunca apareció en /coaches. En v19
-- "solo el registro gratis lo deja en 'pending'": los coaches invitados o de
-- pago quedaban con marketplace_status NULL — fuera del directorio y FUERA
-- DE LA COLA del admin, sin forma de entrar. 12 de 14 coaches estaban así.
-- Además su nombre era su correo (el alta lo usó de nombre) y no había dónde
-- cambiarlo.
--
-- p_name va AL FINAL y con default: la llamada vieja (6 argumentos con
-- nombre) sigue resolviendo a esta misma función mientras se despliega la
-- web. Se reemplaza en la misma transacción para que PostgREST nunca vea
-- dos sobrecargas ambiguas.

begin;

drop function if exists public.update_my_profile(text, text, text[], text[], text[], boolean);

create function public.update_my_profile(
  p_bio text, p_instagram text, p_specialties text[], p_comunas text[],
  p_services text[], p_accepting boolean, p_name text default null
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

  -- La lista de columnas es la autorización: slug, is_platform_admin, role y
  -- gym_id no están. marketplace_status solo puede pasar de NULL a 'pending'
  -- (pedir revisión); aprobar/rechazar sigue siendo del admin. El slug de un
  -- coach ya aprobado NO cambia con el nombre: sus links compartidos siguen vivos.
  update public.users
     set bio = nullif(trim(coalesce(p_bio, '')), ''),
         instagram = nullif(trim(coalesce(p_instagram, '')), ''),
         specialties = coalesce(p_specialties, '{}'),
         comunas = coalesce(p_comunas, '{}'),
         services = coalesce(p_services, '{}'),
         accepting_clients = coalesce(p_accepting, true),
         name = coalesce(v_name, name),
         marketplace_status = coalesce(marketplace_status, 'pending')
   where id = auth.uid() and role = 'coach';

  if not found then
    raise exception 'perfil no encontrado' using errcode = 'P0002';
  end if;
end;
$function$;

revoke all on function public.update_my_profile(text, text, text[], text[], text[], boolean, text) from public, anon;
grant execute on function public.update_my_profile(text, text, text[], text[], text[], boolean, text) to authenticated;

commit;
