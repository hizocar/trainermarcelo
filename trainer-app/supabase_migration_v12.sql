-- ============================================================
-- Migración v12 — Chat coach ↔ cliente
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de la v11
-- ============================================================

CREATE TABLE IF NOT EXISTS public.messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body        text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at  timestamptz NOT NULL DEFAULT now(),
  read_at     timestamptz
);

CREATE INDEX IF NOT EXISTS messages_pair_idx
  ON public.messages (coach_id, client_id, created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Solo los dos participantes ven la conversación
DROP POLICY IF EXISTS "messages_participants_read" ON public.messages;
CREATE POLICY "messages_participants_read" ON public.messages
  FOR SELECT USING (auth.uid() IN (coach_id, client_id));

-- Enviar: debes ser uno de los dos, firmar como tú mismo, y el par debe ser
-- una relación coach-cliente real (el coach_id es el coach del client_id)
DROP POLICY IF EXISTS "messages_send" ON public.messages;
CREATE POLICY "messages_send" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND auth.uid() IN (coach_id, client_id)
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = client_id AND u.coach_id = messages.coach_id
    )
  );

-- Marcar como leído: solo el receptor, y solo el campo read_at
DROP POLICY IF EXISTS "messages_mark_read" ON public.messages;
CREATE POLICY "messages_mark_read" ON public.messages
  FOR UPDATE USING (auth.uid() IN (coach_id, client_id) AND sender_id <> auth.uid())
  WITH CHECK (auth.uid() IN (coach_id, client_id) AND sender_id <> auth.uid());

-- Realtime: publicar los cambios de esta tabla
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
