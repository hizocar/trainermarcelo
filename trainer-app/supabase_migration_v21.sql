-- v21 — El coach puede registrar las series de su alumno.
--
-- Cambio de fondo: la pertenencia de un workout_log deja de derivarse de
-- logged_by y pasa a derivarse del plan al que pertenece la serie. logged_by
-- queda como lo que siempre debió ser: quién tecleó el registro.
--
-- Sin este cambio, un registro hecho por el coach es INVISIBLE para el alumno:
-- la política vieja era logs_client USING (logged_by = auth.uid()), así que su
-- Hoy, su historial y su progreso lo ignorarían y él creería que no entrenó.

create or replace function public.serie_de_mi_plan(p_series_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.exercise_series es
    join public.exercises e       on e.id  = es.exercise_id
    join public.training_days td  on td.id = e.day_id
    join public.workout_plans wp  on wp.id = td.plan_id
    join public.users cli         on cli.id = wp.client_id
    where es.id = p_series_id
      and (cli.id = auth.uid() or cli.coach_id = auth.uid())
  );
$$;

-- En Postgres el EXECUTE de una función nueva se otorga a PUBLIC por defecto,
-- y un grant a authenticated SUMA en vez de reemplazar: sin este revoke, la
-- función queda invocable por cualquiera con la anon key.
revoke execute on function public.serie_de_mi_plan(uuid) from public, anon;
grant  execute on function public.serie_de_mi_plan(uuid) to authenticated;

drop policy if exists "logs_client"        on public.workout_logs;
drop policy if exists "logs_coach"         on public.workout_logs;
drop policy if exists "logs_client_insert" on public.workout_logs;

create policy "logs_lectura" on public.workout_logs
  for select using (public.serie_de_mi_plan(series_id));

create policy "logs_insert" on public.workout_logs
  for insert with check (
    logged_by = auth.uid() and public.serie_de_mi_plan(series_id)
  );

create policy "logs_update" on public.workout_logs
  for update using      (public.serie_de_mi_plan(series_id))
          with check (public.serie_de_mi_plan(series_id));

-- Sin política de delete a propósito: ningún archivo de la app borra
-- workout_logs directamente. Los registros desaparecen solo por el
-- on delete cascade desde exercise_series, que no consulta estas políticas.
-- La política vieja logs_client era FOR ALL y daba borrado al alumno; era un
-- permiso que nadie usaba y no se replica.
