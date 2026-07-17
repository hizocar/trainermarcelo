-- ============================================================
-- Migración v15 — Imágenes y audios en el chat
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de la v14
-- ============================================================

-- 1. Columnas de adjunto en messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS media_type text,   -- 'image' | 'audio' | null (texto)
  ADD COLUMN IF NOT EXISTS media_path text;   -- ruta dentro del bucket chat-media

-- El body ya no es obligatorio si hay adjunto (una foto puede ir sin texto).
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_body_check;
ALTER TABLE public.messages ALTER COLUMN body DROP NOT NULL;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_content_check
  CHECK (
    (body IS NOT NULL AND char_length(body) BETWEEN 1 AND 2000)
    OR media_path IS NOT NULL
  );

-- 2. Bucket PRIVADO para media del chat (se accede con URLs firmadas)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', false)
ON CONFLICT (id) DO NOTHING;

-- Ruta convenida: {coach_id}/{client_id}/{archivo}. Ambos participantes
-- (coach y cliente) tienen su id en la ruta → ambos pueden leer/subir; nadie más.
DROP POLICY IF EXISTS "chat_media_read" ON storage.objects;
CREATE POLICY "chat_media_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'chat-media'
    AND auth.uid()::text IN (
      (storage.foldername(name))[1],
      (storage.foldername(name))[2]
    )
  );

DROP POLICY IF EXISTS "chat_media_write" ON storage.objects;
CREATE POLICY "chat_media_write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'chat-media'
    AND auth.uid()::text IN (
      (storage.foldername(name))[1],
      (storage.foldername(name))[2]
    )
  );
