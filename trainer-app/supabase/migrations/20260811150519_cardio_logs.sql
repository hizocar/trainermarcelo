-- ============================================================
-- Migración v18 — Registro de cardio
-- Ejecutar en el SQL Editor de Supabase
--
-- Registro libre del cliente (no planificado por el coach): "hice 30 min
-- de trote" cualquier día de la semana, sin depender del split de fuerza.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cardio_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,                 -- 'Trote', 'Caminata', 'Bicicleta', 'Elíptica', 'Natación', 'Otro'...
  duration_minutes integer not null,
  logged_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

ALTER TABLE public.cardio_logs
  ADD CONSTRAINT cardio_logs_duration_check CHECK (duration_minutes > 0 AND duration_minutes <= 600);

CREATE INDEX IF NOT EXISTS idx_cardio_logs_user ON public.cardio_logs(user_id, logged_at desc);

ALTER TABLE public.cardio_logs ENABLE ROW LEVEL SECURITY;

-- el cliente ve y administra su propio registro
DROP POLICY IF EXISTS "cardio_client_all" ON public.cardio_logs;
CREATE POLICY "cardio_client_all" ON public.cardio_logs
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- el coach solo LEE el cardio de sus propios clientes
DROP POLICY IF EXISTS "cardio_coach_read" ON public.cardio_logs;
CREATE POLICY "cardio_coach_read" ON public.cardio_logs
  FOR SELECT USING (
    user_id IN (SELECT id FROM public.users WHERE coach_id = auth.uid())
  );
