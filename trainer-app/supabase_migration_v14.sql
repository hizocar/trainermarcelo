-- ============================================================
-- Migración v14 — Notificaciones push de mensajes de chat
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de la v13
-- ============================================================

-- 1. Tokens push de Expo por dispositivo/usuario
CREATE TABLE IF NOT EXISTS public.push_tokens (
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token       text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, token)
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Cada usuario gestiona solo sus propios tokens
DROP POLICY IF EXISTS "push_tokens_owner" ON public.push_tokens;
CREATE POLICY "push_tokens_owner" ON public.push_tokens
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2. Al insertarse un mensaje, avisar a la Edge Function send-push.
--    Usa pg_net (extensión de Supabase) para un POST asíncrono.
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  recipient uuid;
  sender_name text;
  -- URL del proyecto (fija). Si cambias de proyecto, actualiza esta línea.
  project_url text := 'https://nosebyewczvhsdohqrse.supabase.co';
BEGIN
  -- destinatario = el participante que NO envió
  recipient := CASE WHEN NEW.sender_id = NEW.coach_id THEN NEW.client_id ELSE NEW.coach_id END;
  SELECT name INTO sender_name FROM public.users WHERE id = NEW.sender_id;

  PERFORM net.http_post(
    url := project_url || '/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'recipient_id', recipient,
      'title', COALESCE(sender_name, 'Nuevo mensaje'),
      'body', left(NEW.body, 140)
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_message ON public.messages;
CREATE TRIGGER on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();
