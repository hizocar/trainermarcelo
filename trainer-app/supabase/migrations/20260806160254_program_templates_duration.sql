-- ============================================================
-- Migración v16 — Duración en semanas para Programas
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- Duración en semanas de un programa (opcional; null = indefinido, se repite siempre)
ALTER TABLE public.program_templates
  ADD COLUMN IF NOT EXISTS duration_weeks integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'program_templates_duration_weeks_check'
  ) THEN
    ALTER TABLE public.program_templates
      ADD CONSTRAINT program_templates_duration_weeks_check
      CHECK (duration_weeks IS NULL OR duration_weeks BETWEEN 1 AND 52);
  END IF;
END $$;
