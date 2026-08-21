-- v24 — el cliente puede pedir a un coach específico desde el directorio.
--
-- El directorio público (/coaches) deja mirar perfiles; el botón "Me interesa"
-- llega al formulario de /busco-coach con el coach pre-marcado. La solicitud
-- entra al MISMO pozo de siempre — si el elegido no responde, el cliente no
-- queda botado — pero con dos diferencias:
--
--   1. El coach elegido ve la solicitud destacada ("te pidieron a ti").
--   2. El coach elegido no espera las 12 horas de ventaja de los que pagan:
--      es su lead, generado por su perfil.
--
-- Para todos los demás coaches las reglas de hoy quedan intactas.
--
-- NO es reaplicable tal cual: el `drop function` de la firma vieja de
-- create_request solo existe la primera vez. Reintentar es seguro igual:
-- el drop usa `if exists`.

-- ---------- La columna ----------

alter table public.coach_requests
  add column if not exists preferred_coach_id uuid references public.users(id);

-- ---------- create_request: gana el slug preferido, opcional ----------

-- La firma cambia (8 parámetros), y en Postgres eso crea una función NUEVA:
-- sin este drop quedarían las dos y PostgREST no sabría a cuál llamar.
drop function if exists public.create_request(text,text,text,text,text,text,text);

create or replace function public.create_request(
  p_name text, p_whatsapp text, p_comuna text, p_modality text,
  p_goal text, p_availability text, p_trap text,
  p_preferred_slug text default ''
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_recientes int;
  v_preferred uuid;
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

  -- El slug preferido es un DATO, no una condición: si no calza con un coach
  -- aprobado (perfil despublicado entre que el cliente miró y envió, o un
  -- slug manipulado), la solicitud entra igual, sin preferencia. El formulario
  -- del visitante jamás falla por culpa del coach.
  if coalesce(trim(p_preferred_slug), '') <> '' then
    select u.id into v_preferred from public.users u
     where u.slug = trim(p_preferred_slug)
       and u.role = 'coach' and u.marketplace_status = 'approved';
  end if;

  insert into public.coach_requests
    (name, whatsapp, comuna, modality, goal, availability, preferred_coach_id)
  values (trim(p_name), p_whatsapp, trim(p_comuna), p_modality, trim(p_goal),
          nullif(trim(coalesce(p_availability, '')), ''), v_preferred)
  returning id into v_id;

  return v_id;
end;
$$;

-- Firma nueva = privilegios de cero: los default privileges de Supabase le dan
-- EXECUTE a anon Y a PUBLIC sobre toda función nueva (lección de la v20:
-- revocar solo `public` no toca la concesión explícita a anon). Acá anon debe
-- QUEDAR — es el formulario público — así que el revoke es solo higiene del
-- resto y el grant lo dice explícito.
revoke execute on function public.create_request(text,text,text,text,text,text,text,text) from public;
grant execute on function public.create_request(text,text,text,text,text,text,text,text)
  to anon, authenticated;

-- ---------- apply_to_request: el elegido no espera las 12 horas ----------

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

  -- Las 12 horas de ventaja de quien paga NO aplican al coach que el cliente
  -- pidió por nombre: ese lead lo generó su propio perfil.
  if coalesce(public.coach_sub_status(v_coach), '') not in ('active','trialing')
     and v_req.created_at > now() - interval '12 hours'
     and (v_req.preferred_coach_id is null or v_req.preferred_coach_id <> v_coach) then
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

-- ---------- open_requests: el elegido VE su lead dentro de las 12 horas ----------

-- Sin esto el salto de apply_to_request sería inalcanzable: la vista le
-- escondería la solicitud al coach gratis hasta la hora 12, y no puede
-- postular a lo que no ve.
--
-- Se expone `pedida_a_mi` (booleano contra auth.uid()), NO el id del coach
-- preferido: un coach no tiene por qué saber a quién pidieron los demás.
create or replace view public.open_requests
with (security_invoker = false) as
select
  r.id, r.comuna, r.modality, r.goal, r.availability, r.created_at,
  greatest(0, 3 - (select count(*) from public.request_applications a
                   where a.request_id = r.id))::int as slots_left,
  exists (select 1 from public.request_applications a
          where a.request_id = r.id and a.coach_id = auth.uid()) as already_applied,
  (r.preferred_coach_id = auth.uid()) as pedida_a_mi
from public.coach_requests r
where r.status = 'open'
  and r.expires_at > now()
  and public.is_marketplace_coach(auth.uid())
  and (
    coalesce(public.coach_sub_status(auth.uid()), '') in ('active','trialing')
    or r.created_at <= now() - interval '12 hours'
    or r.preferred_coach_id = auth.uid()
  )
  and (
    (select count(*) from public.request_applications a where a.request_id = r.id) < 3
    or exists (select 1 from public.request_applications a
               where a.request_id = r.id and a.coach_id = auth.uid())
  );

grant select on public.open_requests to authenticated;
