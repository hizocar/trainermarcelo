-- ============================================================
-- Migración v8 — Grupos musculares + encuesta diaria de ánimo
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de la v7
-- ============================================================

-- 1. Grupo muscular por ejercicio (lo configura el coach)
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS muscle_group text;

-- 2. Encuesta diaria: ¿cómo te sientes hoy? (una respuesta por día)
CREATE TABLE IF NOT EXISTS public.mood_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mood        text NOT NULL,           -- motivado | bien | normal | cansado | estresado | adolorido
  logged_date date NOT NULL DEFAULT current_date,
  created_at  timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mood_logs_user_date_uidx
  ON public.mood_logs (user_id, logged_date);

ALTER TABLE public.mood_logs ENABLE ROW LEVEL SECURITY;

-- dueño: todo; coach: solo lectura de sus clientes
DROP POLICY IF EXISTS "mood_owner" ON public.mood_logs;
CREATE POLICY "mood_owner" ON public.mood_logs
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "mood_coach_read" ON public.mood_logs;
CREATE POLICY "mood_coach_read" ON public.mood_logs
  FOR SELECT USING (user_id IN (SELECT public.get_my_client_ids()));
