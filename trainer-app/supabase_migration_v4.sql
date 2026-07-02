-- ============================================================
-- Migración v4 — Limpia y recrea TODAS las políticas de users
-- ============================================================

-- DROP ALL policies on users
DROP POLICY IF EXISTS "users_self"           ON public.users;
DROP POLICY IF EXISTS "users_self_select"    ON public.users;
DROP POLICY IF EXISTS "users_self_insert"    ON public.users;
DROP POLICY IF EXISTS "users_self_update"    ON public.users;
DROP POLICY IF EXISTS "coach_sees_clients"   ON public.users;
DROP POLICY IF EXISTS "client_sees_coach"    ON public.users;

-- Recrear todas limpias
CREATE POLICY "users_self_select" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_self_insert" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users_self_update" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Coach ve a sus clientes (rows donde coach_id = coach uid)
CREATE POLICY "coach_sees_clients" ON public.users
  FOR SELECT USING (coach_id = auth.uid());

-- Cliente ve el perfil de su coach
CREATE POLICY "client_sees_coach" ON public.users
  FOR SELECT USING (
    id IN (
      SELECT coach_id FROM public.users u2
      WHERE u2.id = auth.uid() AND u2.coach_id IS NOT NULL
    )
  );

-- ============================================================
-- Asegurar también las policies de workout_plans (DROP + recrear)
-- ============================================================
DROP POLICY IF EXISTS "plans_coach" ON public.workout_plans;
DROP POLICY IF EXISTS "plans_coach_all" ON public.workout_plans;

CREATE POLICY "plans_coach_all" ON public.workout_plans
  FOR ALL USING (
    created_by = auth.uid() OR client_id = auth.uid()
  );

-- ============================================================
-- Asegurar política logs_coach (coach ve logs de sus clientes)
-- ============================================================
DROP POLICY IF EXISTS "logs_coach" ON public.workout_logs;
CREATE POLICY "logs_coach" ON public.workout_logs
  FOR SELECT USING (
    logged_by IN (
      SELECT id FROM public.users WHERE coach_id = auth.uid()
    )
  );
