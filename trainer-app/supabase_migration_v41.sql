-- v41 — la biblioteca de videos (pedido de Yharel): un coach adjunta SU video
-- de técnica a un ejercicio de la biblioteca, y elige si es público (todos
-- los coaches y alumnos pueden usarlo) o privado (solo él y sus alumnos).
-- Al agregar el ejercicio a un plan, el video resuelto se COPIA a la fila
-- del ejercicio (exercises.video_url), así la app no cambia: sigue
-- reproduciendo lo que su fila trae.
--
-- Un video por coach por ejercicio (unique library_id+coach_id): subir de
-- nuevo reemplaza. Nota honesta: el bucket exercise-media sirve por URL
-- pública — "privado" acá protege el DESCUBRIMIENTO (quién ve que existe y
-- quién lo hereda), no el enlace en sí; blindar el enlace exigiría bucket
-- privado con URLs firmadas en app y web (anotado para después).

create table if not exists public.library_videos (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.exercise_library(id) on delete cascade,
  coach_id uuid not null references public.users(id) on delete cascade,
  video_url text not null,
  storage_path text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  unique (library_id, coach_id)
);

alter table public.library_videos enable row level security;

-- ver: los públicos, los míos, y los de MI coach (soy su alumno)
create policy libvid_select on public.library_videos
  for select to authenticated
  using (
    is_public
    or coach_id = auth.uid()
    or coach_id = (select u.coach_id from public.users u where u.id = auth.uid())
  );

-- subir/cambiar/quitar: solo un coach, y solo lo suyo
create policy libvid_insert on public.library_videos
  for insert to authenticated
  with check (
    coach_id = auth.uid()
    and exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'coach')
  );
create policy libvid_update on public.library_videos
  for update to authenticated
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());
create policy libvid_delete on public.library_videos
  for delete to authenticated
  using (coach_id = auth.uid());
