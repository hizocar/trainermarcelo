-- ============================================================
-- Migración v9 — Biblioteca de ejercicios (824)
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de la v8
-- ============================================================

CREATE TABLE IF NOT EXISTS public.exercise_library (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id     text UNIQUE,          -- id externo, para re-sincronizar
  name          text NOT NULL,        -- nombre en español
  name_en       text,
  body_part     text,                 -- categoría gruesa de la fuente
  muscle_group  text NOT NULL,        -- grupo principal (taxonomía de Marcelo)
  muscles       jsonb,                -- activación 0-100 por músculo fino
  equipment     text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exercise_library_name_idx
  ON public.exercise_library USING gin (to_tsvector('spanish', name));

ALTER TABLE public.exercise_library ENABLE ROW LEVEL SECURITY;

-- lectura para cualquier usuario autenticado; escritura solo service role
DROP POLICY IF EXISTS "library_read" ON public.exercise_library;
CREATE POLICY "library_read" ON public.exercise_library
  FOR SELECT TO authenticated USING (true);
