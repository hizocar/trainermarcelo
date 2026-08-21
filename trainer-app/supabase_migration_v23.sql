-- v23 — el plan es del coach ACTUAL del alumno, no de quien lo creó.
--
-- La v3 ancló el acceso a los planes en workout_plans.created_by. La v21
-- ancló el acceso a los REGISTROS en users.coach_id (ver serie_de_mi_plan).
-- Mientras nadie cambie de coach las dos respuestas coinciden, y hoy coinciden:
-- cero planes con created_by distinto del coach del alumno. Pero son dos
-- verdades distintas conviviendo, y el día que un alumno cambie de coach se
-- parten: el coach nuevo vería los registros y no el plan, y el anterior al
-- revés.
--
-- Se alinea todo en coach_id, que es como el producto entiende la
-- responsabilidad: un alumno tiene UN coach, el de hoy, y es quien debe ver y
-- editar su plan. created_by queda como dato histórico —quién lo escribió—,
-- que es justo el mismo cambio de significado que la v21 le dio a logged_by.
--
-- Comprobado antes de aplicar: cero planes cuyo alumno no tenga coach_id y
-- cero planes con created_by distinto del coach actual, así que nadie pierde
-- acceso con este cambio.
--
-- NO es reaplicable tal cual: los `drop policy if exists` cubren los nombres
-- que se reemplazan, y volver a correrla es seguro porque cada create va
-- después de su drop.

-- ---------- Ayudante, espejo de serie_de_mi_plan de la v21 ----------

create or replace function public.plan_mio(p_plan_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.workout_plans wp
    join public.users cli on cli.id = wp.client_id
    where wp.id = p_plan_id
      and (cli.id = auth.uid() or cli.coach_id = auth.uid())
  );
$$;

revoke execute on function public.plan_mio(uuid) from public, anon;
grant execute on function public.plan_mio(uuid) to authenticated;

-- Solo el coach: para escribir no basta ser el alumno.
create or replace function public.plan_de_mi_alumno(p_plan_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.workout_plans wp
    join public.users cli on cli.id = wp.client_id
    where wp.id = p_plan_id and cli.coach_id = auth.uid()
  );
$$;

revoke execute on function public.plan_de_mi_alumno(uuid) from public, anon;
grant execute on function public.plan_de_mi_alumno(uuid) to authenticated;

-- ---------- workout_plans ----------

drop policy if exists "plans_coach_all"   on public.workout_plans;
drop policy if exists "plans_client_read" on public.workout_plans;

create policy "plans_lectura" on public.workout_plans for select
  using (client_id = auth.uid()
         or client_id in (select id from public.users where coach_id = auth.uid()));

create policy "plans_coach" on public.workout_plans for all
  using (client_id in (select id from public.users where coach_id = auth.uid()))
  with check (client_id in (select id from public.users where coach_id = auth.uid()));

-- ---------- training_days ----------

drop policy if exists "days_read"  on public.training_days;
drop policy if exists "days_write" on public.training_days;

create policy "days_lectura" on public.training_days for select
  using (public.plan_mio(plan_id));

create policy "days_escritura" on public.training_days for all
  using (public.plan_de_mi_alumno(plan_id))
  with check (public.plan_de_mi_alumno(plan_id));

-- ---------- exercises ----------

drop policy if exists "exercises_read"  on public.exercises;
drop policy if exists "exercises_write" on public.exercises;

create policy "exercises_lectura" on public.exercises for select
  using (exists (select 1 from public.training_days td
                  where td.id = day_id and public.plan_mio(td.plan_id)));

create policy "exercises_escritura" on public.exercises for all
  using (exists (select 1 from public.training_days td
                  where td.id = day_id and public.plan_de_mi_alumno(td.plan_id)))
  with check (exists (select 1 from public.training_days td
                       where td.id = day_id and public.plan_de_mi_alumno(td.plan_id)));

-- ---------- exercise_series ----------

drop policy if exists "series_read"  on public.exercise_series;
drop policy if exists "series_write" on public.exercise_series;

create policy "series_lectura" on public.exercise_series for select
  using (exists (select 1 from public.exercises e
                  join public.training_days td on td.id = e.day_id
                  where e.id = exercise_id and public.plan_mio(td.plan_id)));

create policy "series_escritura" on public.exercise_series for all
  using (exists (select 1 from public.exercises e
                  join public.training_days td on td.id = e.day_id
                  where e.id = exercise_id and public.plan_de_mi_alumno(td.plan_id)))
  with check (exists (select 1 from public.exercises e
                       join public.training_days td on td.id = e.day_id
                       where e.id = exercise_id and public.plan_de_mi_alumno(td.plan_id)));
