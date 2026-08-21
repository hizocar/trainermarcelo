-- v21 — El coach puede registrar las series de su alumno.
--
-- Cambio de fondo: la pertenencia de un workout_log deja de derivarse de
-- logged_by y pasa a derivarse del plan al que pertenece la serie. logged_by
-- queda como lo que siempre debió ser: quién tecleó el registro.
--
-- Sin este cambio, un registro hecho por el coach es INVISIBLE para el alumno:
-- la política vigente desde la v3 es logs_client_select USING (logged_by = auth.uid()), así que su
-- Hoy, su historial y su progreso lo ignorarían y él creería que no entrenó.

create or replace function public.serie_de_mi_plan(p_series_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
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

drop policy if exists "logs_client"        on public.workout_logs; -- red: no-op si la base ya pasó por la v3
drop policy if exists "logs_client_select" on public.workout_logs;
drop policy if exists "logs_client_update" on public.workout_logs;
drop policy if exists "logs_coach"         on public.workout_logs;
drop policy if exists "logs_client_insert" on public.workout_logs;

create policy "logs_lectura" on public.workout_logs
  for select using (public.serie_de_mi_plan(series_id));

create policy "logs_insert" on public.workout_logs
  for insert with check (
    logged_by = auth.uid() and public.serie_de_mi_plan(series_id)
  );

-- El WITH CHECK exige logged_by = auth.uid(): sin eso, cualquiera puede dejar
-- el uuid que quiera en esa columna al actualizar una fila que sí le pertenece.
-- No estorba al caso legítimo de esta función -- el coach reemplazando una
-- serie de su alumno, donde logged_by pasa a ser el coach --: el único lugar
-- que escribe workout_logs es upsertLog (src/lib/offline.ts) y siempre manda
-- logged_by = quien está tecleando, tanto al insertar como al actualizar.
create policy "logs_update" on public.workout_logs
  for update using      (public.serie_de_mi_plan(series_id))
          with check (
            logged_by = auth.uid() and public.serie_de_mi_plan(series_id)
          );

-- logs_lectura evalúa serie_de_mi_plan (security definer, no inlineable) una
-- vez por fila, así que conviene que el filtro por semana llegue por índice.
-- El único índice que había es (series_id, week_number) y ahí week_number no
-- es la columna líder, por lo que no sirve para el .in('week_number', ...) del
-- panel del coach, que no filtra por serie.
create index if not exists workout_logs_week_number_idx
  on public.workout_logs (week_number);

-- Sin política de delete a propósito: ningún archivo de la app borra
-- workout_logs directamente. Los registros desaparecen solo por el
-- on delete cascade desde exercise_series, que no consulta estas políticas.
-- La política logs_client (FOR ALL, drop de arriba) daba borrado al alumno en el
-- esquema original; desde la v3 ya no existe -- logs_client_select/_update/_insert
-- no incluían delete -- así que no había permiso vigente que replicar.
