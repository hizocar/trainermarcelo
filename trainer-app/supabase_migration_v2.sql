-- ============================================================
-- Trainer App — Migración v2
-- Ejecutar en SQL Editor de Supabase DESPUÉS del schema inicial
-- ============================================================

-- 1. Agregar día de la semana a training_days
--    0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb
ALTER TABLE public.training_days
  ADD COLUMN IF NOT EXISTS week_day int;

-- 2. Tabla de invitaciones (coach invita clientes por email)
CREATE TABLE IF NOT EXISTS public.invitations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email      text NOT NULL,
  name       text NOT NULL,
  status     text NOT NULL DEFAULT 'pending',  -- pending | accepted
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitations_coach" ON public.invitations
  FOR ALL USING (coach_id = auth.uid());

-- 3. RLS: clientes pueden ver el perfil de su coach
DROP POLICY IF EXISTS "client_sees_coach" ON public.users;
CREATE POLICY "client_sees_coach" ON public.users
  FOR SELECT USING (
    id = (SELECT coach_id FROM public.users WHERE id = auth.uid())
  );

-- 4. RLS: coach puede editar datos de sus clientes (ejercicios, días, series, logs)
DROP POLICY IF EXISTS "coach_edit_days" ON public.training_days;
CREATE POLICY "coach_edit_days" ON public.training_days
  FOR ALL USING (
    plan_id IN (
      SELECT id FROM public.workout_plans WHERE created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "coach_edit_exercises" ON public.exercises;
CREATE POLICY "coach_edit_exercises" ON public.exercises
  FOR ALL USING (
    day_id IN (
      SELECT td.id FROM public.training_days td
      JOIN public.workout_plans wp ON wp.id = td.plan_id
      WHERE wp.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "coach_edit_series" ON public.exercise_series;
CREATE POLICY "coach_edit_series" ON public.exercise_series
  FOR ALL USING (
    exercise_id IN (
      SELECT e.id FROM public.exercises e
      JOIN public.training_days td ON td.id = e.day_id
      JOIN public.workout_plans wp ON wp.id = td.plan_id
      WHERE wp.created_by = auth.uid()
    )
  );

-- 5. Clientes pueden insertar sus propios logs
DROP POLICY IF EXISTS "logs_client_insert" ON public.workout_logs;
CREATE POLICY "logs_client_insert" ON public.workout_logs
  FOR INSERT WITH CHECK (logged_by = auth.uid());
