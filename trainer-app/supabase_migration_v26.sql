-- v26 — comentarios de alumnos verificados en la ficha pública del coach.
--
-- Solo puede opinar quien ES alumno del coach — y eso no lo declara el que
-- escribe: lo verifica la base contra users.coach_id, que es la ventaja que
-- ningún marketplace genérico tiene. Ni el coach puede inventarse reseñas a
-- favor, ni la competencia en contra.
--
--   una opinión por alumno (única por coach+autor; volver a enviar reemplaza)
--   escritura SOLO por submit_review (la tabla no tiene política de insert)
--   lectura pública por la vista public_coach_reviews: nombre de pila e
--   inicial, nunca el nombre completo ni el id del alumno
--
-- Reaplicable: create table if not exists + create or replace.

create table if not exists public.coach_reviews (
  id         uuid primary key default gen_random_uuid(),
  coach_id   uuid not null references public.users(id),
  author_id  uuid not null references public.users(id),
  body       text not null check (length(trim(body)) between 20 and 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coach_id, author_id)
);

alter table public.coach_reviews enable row level security;

-- El autor puede ver y borrar lo suyo; nadie más toca la tabla directo.
drop policy if exists "reviews_autor" on public.coach_reviews;
create policy "reviews_autor" on public.coach_reviews
  for select using (author_id = auth.uid());

drop policy if exists "reviews_autor_delete" on public.coach_reviews;
create policy "reviews_autor_delete" on public.coach_reviews
  for delete using (author_id = auth.uid());

-- ---------- Escribir: el vínculo lo verifica la base ----------

create or replace function public.submit_review(p_coach_slug text, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_autor uuid := auth.uid();
  v_coach uuid;
begin
  if v_autor is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;

  if length(trim(coalesce(p_body, ''))) < 20 then
    raise exception 'comentario demasiado corto' using errcode = 'P0001';
  end if;
  if length(p_body) > 600 then
    raise exception 'comentario demasiado largo' using errcode = 'P0001';
  end if;

  select u.id into v_coach from public.users u
   where u.slug = trim(p_coach_slug)
     and u.role = 'coach' and u.marketplace_status = 'approved';
  if v_coach is null then
    raise exception 'coach no encontrado' using errcode = 'P0002';
  end if;

  -- El corazón: quien firma tiene que SER alumno de este coach. No se le
  -- pregunta al formulario — se le pregunta a la base.
  if not exists (select 1 from public.users a
                  where a.id = v_autor and a.role = 'client' and a.coach_id = v_coach) then
    raise exception 'solo sus alumnos pueden opinar' using errcode = '42501';
  end if;

  insert into public.coach_reviews (coach_id, author_id, body)
  values (v_coach, v_autor, trim(p_body))
  on conflict (coach_id, author_id)
  do update set body = excluded.body, updated_at = now();
end;
$$;

revoke execute on function public.submit_review(text, text) from public, anon;
grant execute on function public.submit_review(text, text) to authenticated;

-- ---------- Leer: público, con el nombre recortado ----------

create or replace view public.public_coach_reviews
with (security_invoker = false) as
select
  c.slug as coach_slug,
  r.body,
  r.updated_at,
  -- "Camila S." — el nombre de pila y una inicial. El nombre completo del
  -- alumno no es un dato publicable.
  initcap(split_part(trim(a.name), ' ', 1)) ||
    case when split_part(trim(a.name), ' ', 2) <> ''
         then ' ' || upper(left(split_part(trim(a.name), ' ', 2), 1)) || '.'
         else '' end as author_name
from public.coach_reviews r
join public.users a on a.id = r.author_id
join public.users c on c.id = r.coach_id
where c.marketplace_status = 'approved' and c.slug is not null
  -- si el alumno se cambió de coach, su comentario sigue (opinó cuando lo era)
order by r.updated_at desc;

grant select on public.public_coach_reviews to anon, authenticated;
