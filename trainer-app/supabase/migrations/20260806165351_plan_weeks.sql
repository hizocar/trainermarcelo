-- ============================================================
-- Migración v17 — Gestión de semanas
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de la v16
--
-- Antes: un plan tenía UN solo split (training_days) que se repetía
-- indefinidamente para siempre — no había forma de terminarlo, duplicarlo
-- ni tener una semana distinta de otra sin sobrescribir la anterior.
--
-- Ahora: cada plan tiene una o más "semanas" (plan_weeks), cada una con
-- sus propios días/ejercicios/series, 100% independientes entre sí.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.plan_weeks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans(id) on delete cascade,
  week_number int not null,          -- misma numeración de semana calendario que ya usa todo el resto de la app (workout_logs.week_number, getCurrentWeek())
  name text not null default 'Semana',
  is_deload boolean not null default false,
  -- si el cliente llega a una semana sin definir, se busca la última semana
  -- ANTERIOR con repeat_forever=true y se usa esa (así los planes que ya
  -- existían antes de esta función no se rompen de un día para otro).
  -- Las semanas nuevas parten en false: si el coach no planificó la
  -- siguiente, el cliente ve "sin plan" en vez de arrastrar la anterior sola.
  repeat_forever boolean not null default false,
  archived boolean not null default false,  -- "eliminar semana" archiva, no borra: protege el historial ya registrado
  created_at timestamptz not null default now(),
  unique (plan_id, week_number)
);

ALTER TABLE public.training_days
  ADD COLUMN IF NOT EXISTS plan_week_id uuid references public.plan_weeks(id) on delete cascade;

-- Backfill: cada plan existente pasa a tener UNA sola "Semana 1" que agrupa
-- todos sus días actuales, marcada repeat_forever=true — mismo
-- comportamiento visible que tenían hoy (se repite siempre), y desde ahí el
-- coach ya puede duplicar/crear semanas nuevas cuando quiera.
DO $$
DECLARE
  p RECORD;
  new_week_id uuid;
BEGIN
  FOR p IN
    SELECT DISTINCT plan_id FROM public.training_days WHERE plan_week_id IS NULL
  LOOP
    INSERT INTO public.plan_weeks (plan_id, week_number, name, repeat_forever)
    VALUES (p.plan_id, 1, 'Semana 1', true)
    ON CONFLICT (plan_id, week_number) DO UPDATE SET name = plan_weeks.name
    RETURNING id INTO new_week_id;

    UPDATE public.training_days
    SET plan_week_id = new_week_id
    WHERE plan_id = p.plan_id AND plan_week_id IS NULL;
  END LOOP;
END $$;

-- RLS: mismo dueño que workout_plans/training_days ya usan en toda la app
ALTER TABLE public.plan_weeks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plan_weeks_read" ON public.plan_weeks;
CREATE POLICY "plan_weeks_read" ON public.plan_weeks
  FOR SELECT USING (
    plan_id IN (
      SELECT id FROM public.workout_plans
      WHERE created_by = auth.uid() OR client_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "plan_weeks_write" ON public.plan_weeks;
CREATE POLICY "plan_weeks_write" ON public.plan_weeks
  FOR ALL USING (
    plan_id IN (SELECT id FROM public.workout_plans WHERE created_by = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_training_days_plan_week ON public.training_days(plan_week_id);
CREATE INDEX IF NOT EXISTS idx_plan_weeks_plan ON public.plan_weeks(plan_id);
