-- ============================================================
-- Migración v3 — Fix RLS (DROP ALL primero, luego CREATE)
-- ============================================================

-- users
DROP POLICY IF EXISTS "users_self" ON public.users;
DROP POLICY IF EXISTS "users_self_select" ON public.users;
DROP POLICY IF EXISTS "users_self_insert" ON public.users;
DROP POLICY IF EXISTS "users_self_update" ON public.users;

CREATE POLICY "users_self_select" ON public.users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_self_insert" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_self_update" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- workout_logs
DROP POLICY IF EXISTS "logs_client" ON public.workout_logs;
DROP POLICY IF EXISTS "logs_client_insert" ON public.workout_logs;
DROP POLICY IF EXISTS "logs_client_select" ON public.workout_logs;
DROP POLICY IF EXISTS "logs_client_update" ON public.workout_logs;

CREATE POLICY "logs_client_select" ON public.workout_logs
  FOR SELECT USING (logged_by = auth.uid());
CREATE POLICY "logs_client_insert" ON public.workout_logs
  FOR INSERT WITH CHECK (logged_by = auth.uid());
CREATE POLICY "logs_client_update" ON public.workout_logs
  FOR UPDATE USING (logged_by = auth.uid());

-- exercises
DROP POLICY IF EXISTS "exercises_access" ON public.exercises;
DROP POLICY IF EXISTS "coach_edit_exercises" ON public.exercises;

CREATE POLICY "exercises_read" ON public.exercises
  FOR SELECT USING (
    day_id IN (
      SELECT td.id FROM public.training_days td
      JOIN public.workout_plans wp ON wp.id = td.plan_id
      WHERE wp.created_by = auth.uid() OR wp.client_id = auth.uid()
    )
  );
CREATE POLICY "exercises_write" ON public.exercises
  FOR ALL USING (
    day_id IN (
      SELECT td.id FROM public.training_days td
      JOIN public.workout_plans wp ON wp.id = td.plan_id
      WHERE wp.created_by = auth.uid()
    )
  );

-- training_days
DROP POLICY IF EXISTS "days_access" ON public.training_days;
DROP POLICY IF EXISTS "coach_edit_days" ON public.training_days;

CREATE POLICY "days_read" ON public.training_days
  FOR SELECT USING (
    plan_id IN (
      SELECT id FROM public.workout_plans
      WHERE created_by = auth.uid() OR client_id = auth.uid()
    )
  );
CREATE POLICY "days_write" ON public.training_days
  FOR ALL USING (
    plan_id IN (
      SELECT id FROM public.workout_plans WHERE created_by = auth.uid()
    )
  );

-- exercise_series
DROP POLICY IF EXISTS "series_access" ON public.exercise_series;
DROP POLICY IF EXISTS "coach_edit_series" ON public.exercise_series;

CREATE POLICY "series_read" ON public.exercise_series
  FOR SELECT USING (
    exercise_id IN (
      SELECT e.id FROM public.exercises e
      JOIN public.training_days td ON td.id = e.day_id
      JOIN public.workout_plans wp ON wp.id = td.plan_id
      WHERE wp.created_by = auth.uid() OR wp.client_id = auth.uid()
    )
  );
CREATE POLICY "series_write" ON public.exercise_series
  FOR ALL USING (
    exercise_id IN (
      SELECT e.id FROM public.exercises e
      JOIN public.training_days td ON td.id = e.day_id
      JOIN public.workout_plans wp ON wp.id = td.plan_id
      WHERE wp.created_by = auth.uid()
    )
  );
