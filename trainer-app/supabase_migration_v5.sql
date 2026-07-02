-- ============================================================
-- Migración v5 — Fix infinite recursion in RLS policies
-- Usar funciones SECURITY DEFINER para evitar auto-referencia
-- ============================================================

-- Funciones helper que leen users SIN pasar por RLS (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_my_coach_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT coach_id FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_client_ids()
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT id FROM public.users WHERE coach_id = auth.uid();
$$;

-- Reemplazar client_sees_coach sin subquery recursiva
DROP POLICY IF EXISTS "client_sees_coach" ON public.users;
CREATE POLICY "client_sees_coach" ON public.users
  FOR SELECT USING (id = public.get_my_coach_id());

-- Reemplazar logs_coach sin subquery recursiva
DROP POLICY IF EXISTS "logs_coach" ON public.workout_logs;
CREATE POLICY "logs_coach" ON public.workout_logs
  FOR SELECT USING (logged_by IN (SELECT public.get_my_client_ids()));
