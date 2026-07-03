-- ============================================================
-- Migración v6 — Media de ejercicios, avatares, storage y hardening
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de la v5
-- ============================================================

-- 1. Ejemplo del ejercicio: imagen, video y notas del coach
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS notes text;

-- 2. Avatar de usuario
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- 3. Un log por serie+semana → permite upsert sin carrera de duplicados
--    (si ya existen duplicados, conservar el más reciente antes de crear el índice)
DELETE FROM public.workout_logs wl
USING public.workout_logs wl2
WHERE wl.series_id = wl2.series_id
  AND wl.week_number = wl2.week_number
  AND wl.logged_at < wl2.logged_at;

CREATE UNIQUE INDEX IF NOT EXISTS workout_logs_series_week_uidx
  ON public.workout_logs (series_id, week_number);

-- 4. Hardening: fijar search_path en funciones SECURITY DEFINER
--    (evita hijacking del search_path por objetos en otros schemas)
CREATE OR REPLACE FUNCTION public.get_my_coach_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT coach_id FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_client_ids()
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT id FROM public.users WHERE coach_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'client')
  );
  RETURN NEW;
END;
$$;

-- 5. Hardening: el cliente solo LEE su plan; solo el coach lo modifica
DROP POLICY IF EXISTS "plans_coach" ON public.workout_plans;
DROP POLICY IF EXISTS "plans_coach_all" ON public.workout_plans;

CREATE POLICY "plans_coach_all" ON public.workout_plans
  FOR ALL USING (created_by = auth.uid());

CREATE POLICY "plans_client_read" ON public.workout_plans
  FOR SELECT USING (client_id = auth.uid());

-- 6. Hardening: impedir que un usuario cambie su propio rol o coach_id
DROP POLICY IF EXISTS "users_self_update" ON public.users;
CREATE POLICY "users_self_update" ON public.users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT u.role FROM public.users u WHERE u.id = auth.uid())
    AND coach_id IS NOT DISTINCT FROM (SELECT u.coach_id FROM public.users u WHERE u.id = auth.uid())
  );

-- 7. Hardening: solo se pueden registrar logs sobre series del propio plan
DROP POLICY IF EXISTS "logs_client_insert" ON public.workout_logs;
CREATE POLICY "logs_client_insert" ON public.workout_logs
  FOR INSERT WITH CHECK (
    logged_by = auth.uid()
    AND series_id IN (
      SELECT es.id FROM public.exercise_series es
      JOIN public.exercises e ON e.id = es.exercise_id
      JOIN public.training_days td ON td.id = e.day_id
      JOIN public.workout_plans wp ON wp.id = td.plan_id
      WHERE wp.client_id = auth.uid() OR wp.created_by = auth.uid()
    )
  );

-- 8. Storage: buckets públicos de lectura para media de ejercicios y avatares
INSERT INTO storage.buckets (id, name, public)
VALUES ('exercise-media', 'exercise-media', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Solo coaches suben/gestionan media de ejercicios, en su propia carpeta {uid}/...
DROP POLICY IF EXISTS "exercise_media_read" ON storage.objects;
CREATE POLICY "exercise_media_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'exercise-media');

DROP POLICY IF EXISTS "exercise_media_write" ON storage.objects;
CREATE POLICY "exercise_media_write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'exercise-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'coach')
  );

DROP POLICY IF EXISTS "exercise_media_update" ON storage.objects;
CREATE POLICY "exercise_media_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'exercise-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "exercise_media_delete" ON storage.objects;
CREATE POLICY "exercise_media_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'exercise-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Cada usuario gestiona su avatar en su carpeta {uid}/...
DROP POLICY IF EXISTS "avatars_read" ON storage.objects;
CREATE POLICY "avatars_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_write" ON storage.objects;
CREATE POLICY "avatars_write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
CREATE POLICY "avatars_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_delete" ON storage.objects;
CREATE POLICY "avatars_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
