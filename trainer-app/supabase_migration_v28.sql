-- v28 — sesiones de entrenamiento: cuándo empezó y cuánto duró.
--
-- El alumno marca "comenzar" en su día y la app cuenta contra `started_at` —
-- el mismo patrón del temporizador de descanso: se guarda el instante, nunca
-- los segundos, porque iOS congela los timers de JS con la pantalla bloqueada
-- y un timestamp siempre vuelve correcto. "Terminar" escribe `ended_at` y la
-- duración ya calculada, para que ninguna consulta tenga que restarle fechas.
--
-- RLS con los anclajes de la casa: el alumno escribe SOLO lo suyo, y lo lee
-- él y su coach ACTUAL (users.coach_id, como la v21/v23 — no quién creó nada).
--
-- Reaplicable: create table if not exists + drop policy if exists.

create table if not exists public.workout_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id),
  day_id           uuid not null references public.training_days(id),
  week_number      int  not null,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  duration_seconds int check (duration_seconds is null or duration_seconds >= 0),
  -- una sola sesión ABIERTA por alumno: la app retoma esa al volver
  constraint sesion_cerrada_coherente
    check ((ended_at is null) = (duration_seconds is null))
);

create unique index if not exists una_sesion_abierta_por_alumno
  on public.workout_sessions (user_id) where ended_at is null;

create index if not exists sesiones_por_alumno
  on public.workout_sessions (user_id, started_at desc);

alter table public.workout_sessions enable row level security;

drop policy if exists "sesiones_insert" on public.workout_sessions;
create policy "sesiones_insert" on public.workout_sessions
  for insert with check (user_id = auth.uid());

drop policy if exists "sesiones_update" on public.workout_sessions;
create policy "sesiones_update" on public.workout_sessions
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "sesiones_delete" on public.workout_sessions;
create policy "sesiones_delete" on public.workout_sessions
  for delete using (user_id = auth.uid());

drop policy if exists "sesiones_lectura" on public.workout_sessions;
create policy "sesiones_lectura" on public.workout_sessions
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.users al
                where al.id = user_id and al.coach_id = auth.uid())
  );
