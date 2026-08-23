-- v30 — rutina propia: el cliente SIN coach arma su propio plan.
--
-- El cliente autónomo usa EL MISMO modelo de datos (workout_plans → plan_weeks
-- → training_days → exercises → exercise_series), con él como client_id y
-- created_by. Por eso todo lo demás —Hoy, registro de series, cronómetro,
-- historial, progreso— funciona sin tocarse: siempre buscó el plan por
-- client_id sin importar quién lo escribió.
--
-- La regla de negocio vive ACÁ, no en la interfaz: un cliente CON coach no
-- puede modificar su rutina — eso lo hace su coach, como siempre. Estas
-- políticas son permisivas (se suman con OR a las del coach de la v23) y solo
-- calzan cuando users.coach_id IS NULL. El día que un coach lo tome
-- (coach_id se llena), el cliente queda de solo lectura automáticamente.
--
-- Reaplicable: create or replace + drop policy if exists.

-- ---------- Ayudantes ----------

create or replace function public.sin_coach()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.users me
    where me.id = auth.uid() and me.role = 'client' and me.coach_id is null
  );
$$;

revoke execute on function public.sin_coach() from public, anon;
grant execute on function public.sin_coach() to authenticated;

-- El plan es mío y no tengo coach: puedo escribirlo entero.
create or replace function public.plan_propio(p_plan_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.workout_plans wp
    join public.users me on me.id = wp.client_id
    where wp.id = p_plan_id
      and me.id = auth.uid() and me.role = 'client' and me.coach_id is null
  );
$$;

revoke execute on function public.plan_propio(uuid) from public, anon;
grant execute on function public.plan_propio(uuid) to authenticated;

-- ---------- workout_plans ----------

drop policy if exists "plans_autonomo" on public.workout_plans;
create policy "plans_autonomo" on public.workout_plans for all
  using (client_id = auth.uid() and public.sin_coach())
  with check (client_id = auth.uid() and created_by = auth.uid() and public.sin_coach());

-- ---------- plan_weeks ----------

drop policy if exists "weeks_autonomo" on public.plan_weeks;
create policy "weeks_autonomo" on public.plan_weeks for all
  using (public.plan_propio(plan_id))
  with check (public.plan_propio(plan_id));

-- ---------- training_days ----------

drop policy if exists "days_autonomo" on public.training_days;
create policy "days_autonomo" on public.training_days for all
  using (public.plan_propio(plan_id))
  with check (public.plan_propio(plan_id));

-- ---------- exercises ----------

drop policy if exists "exercises_autonomo" on public.exercises;
create policy "exercises_autonomo" on public.exercises for all
  using (exists (select 1 from public.training_days td
                  where td.id = day_id and public.plan_propio(td.plan_id)))
  with check (exists (select 1 from public.training_days td
                       where td.id = day_id and public.plan_propio(td.plan_id)));

-- ---------- exercise_series ----------

drop policy if exists "series_autonomo" on public.exercise_series;
create policy "series_autonomo" on public.exercise_series for all
  using (exists (select 1 from public.exercises e
                  join public.training_days td on td.id = e.day_id
                  where e.id = exercise_id and public.plan_propio(td.plan_id)))
  with check (exists (select 1 from public.exercises e
                       join public.training_days td on td.id = e.day_id
                       where e.id = exercise_id and public.plan_propio(td.plan_id)));
