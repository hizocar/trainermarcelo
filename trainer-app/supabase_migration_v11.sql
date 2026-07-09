-- ============================================================
-- Migración v11 — Parámetros avanzados, plantillas, notas y mesociclos
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de la v10
-- ============================================================

-- 1. Parámetros avanzados por ejercicio (los configura el coach)
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS tempo text,           -- ej: "3-0-1"
  ADD COLUMN IF NOT EXISTS rest_seconds int,     -- descanso entre series
  ADD COLUMN IF NOT EXISTS target_rir text;      -- RIR objetivo, ej: "1-2"

-- 2. RIR reportado por el cliente en cada serie
ALTER TABLE public.workout_logs
  ADD COLUMN IF NOT EXISTS rir int;              -- 0-5, opcional

-- 3. Notas de sesión del cliente (una por día+semana, visible para el coach)
CREATE TABLE IF NOT EXISTS public.session_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  day_id      uuid NOT NULL REFERENCES public.training_days(id) ON DELETE CASCADE,
  week_number int NOT NULL,
  note        text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS session_notes_uidx
  ON public.session_notes (user_id, day_id, week_number);

ALTER TABLE public.session_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notes_owner" ON public.session_notes;
CREATE POLICY "notes_owner" ON public.session_notes
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notes_coach_read" ON public.session_notes;
CREATE POLICY "notes_coach_read" ON public.session_notes
  FOR SELECT USING (user_id IN (SELECT public.get_my_client_ids()));

-- 4. Plantillas de días de entrenamiento (del coach)
CREATE TABLE IF NOT EXISTS public.day_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  exercises   jsonb NOT NULL,       -- snapshot de los ejercicios del día
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.day_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "templates_owner" ON public.day_templates;
CREATE POLICY "templates_owner" ON public.day_templates
  FOR ALL USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- 5. Mesociclos: fase por semana del plan
CREATE TABLE IF NOT EXISTS public.week_phases (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     uuid NOT NULL REFERENCES public.workout_plans(id) ON DELETE CASCADE,
  week_number int NOT NULL,
  phase       text NOT NULL,        -- acumulacion | intensificacion | descarga
  created_at  timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS week_phases_uidx
  ON public.week_phases (plan_id, week_number);

ALTER TABLE public.week_phases ENABLE ROW LEVEL SECURITY;

-- coach gestiona; cliente lee las de su plan
DROP POLICY IF EXISTS "phases_coach" ON public.week_phases;
CREATE POLICY "phases_coach" ON public.week_phases
  FOR ALL USING (
    plan_id IN (SELECT id FROM public.workout_plans WHERE created_by = auth.uid())
  );

DROP POLICY IF EXISTS "phases_client_read" ON public.week_phases;
CREATE POLICY "phases_client_read" ON public.week_phases
  FOR SELECT USING (
    plan_id IN (SELECT id FROM public.workout_plans WHERE client_id = auth.uid())
  );
