-- ============================================================
-- Migración v10 — Homologación de ejercicios con la biblioteca
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de la v9
-- ============================================================

-- Nombre en inglés + vínculo al ejercicio canónico de la biblioteca
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS library_id uuid REFERENCES public.exercise_library(id);
