-- ============================================================
-- Migración v7 — Progreso corporal: métricas + fotos privadas
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de la v6
-- ============================================================

-- 1. Métricas corporales (peso, estatura, % grasa, foto de progreso)
CREATE TABLE IF NOT EXISTS public.body_metrics (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  measured_at   date NOT NULL DEFAULT current_date,
  weight_kg     float,
  height_cm     float,
  body_fat_pct  float,
  notes         text,
  photo_path    text,          -- path dentro del bucket privado progress-photos
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS body_metrics_user_date_idx
  ON public.body_metrics (user_id, measured_at DESC);

ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;

-- dueño: todo; coach: solo lectura de sus clientes
DROP POLICY IF EXISTS "metrics_owner" ON public.body_metrics;
CREATE POLICY "metrics_owner" ON public.body_metrics
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "metrics_coach_read" ON public.body_metrics;
CREATE POLICY "metrics_coach_read" ON public.body_metrics
  FOR SELECT USING (user_id IN (SELECT public.get_my_client_ids()));

-- 2. Bucket PRIVADO para fotos de progreso (contenido sensible:
--    se accede solo con URLs firmadas, nunca públicas)
INSERT INTO storage.buckets (id, name, public)
VALUES ('progress-photos', 'progress-photos', false)
ON CONFLICT (id) DO NOTHING;

-- dueño gestiona su carpeta {uid}/...
DROP POLICY IF EXISTS "progress_photos_owner_read" ON storage.objects;
CREATE POLICY "progress_photos_owner_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'progress-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "progress_photos_owner_write" ON storage.objects;
CREATE POLICY "progress_photos_owner_write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'progress-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "progress_photos_owner_delete" ON storage.objects;
CREATE POLICY "progress_photos_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'progress-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- coach puede VER las fotos de sus clientes (solo lectura)
DROP POLICY IF EXISTS "progress_photos_coach_read" ON storage.objects;
CREATE POLICY "progress_photos_coach_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'progress-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.users WHERE coach_id = auth.uid()
    )
  );
