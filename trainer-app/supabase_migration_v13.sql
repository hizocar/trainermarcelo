-- ============================================================
-- Migración v13 — Multi-coach: alta con aprobación del dueño
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de la v12
-- ============================================================

-- 1. Nuevo valor de rol: coach_pending (coach registrado, aún sin aprobar)
--    Los enum de Postgres no permiten quitar valores, solo agregar.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'coach_pending';

-- 2. Marca de "dueño de la plataforma": quien aprueba a los coaches.
--    Solo Marcelo. Se identifica con una columna, no con un rol nuevo.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false;

-- Marca a Marcelo como dueño (su email de coach)
UPDATE public.users SET is_owner = true WHERE email = 'marcelo@trainerapp.com';

-- 3. Función helper: ¿el usuario actual es el dueño? (SECURITY DEFINER, sin recursión RLS)
CREATE OR REPLACE FUNCTION public.is_platform_owner()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT COALESCE((SELECT is_owner FROM public.users WHERE id = auth.uid()), false);
$$;

-- 4. El dueño puede ver y aprobar (UPDATE) a los coaches pendientes
DROP POLICY IF EXISTS "owner_sees_coaches" ON public.users;
CREATE POLICY "owner_sees_coaches" ON public.users
  FOR SELECT USING (public.is_platform_owner());

DROP POLICY IF EXISTS "owner_approves_coaches" ON public.users;
CREATE POLICY "owner_approves_coaches" ON public.users
  FOR UPDATE USING (public.is_platform_owner())
  WITH CHECK (public.is_platform_owner());

-- 5. Trigger endurecido: NADIE puede auto-asignarse 'coach' en el registro.
--    Cualquier intento de registrarse como coach queda en 'coach_pending';
--    solo el dueño (o el service role) puede otorgar el rol 'coach' real.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  requested text := NEW.raw_user_meta_data->>'role';
  final_role user_role;
BEGIN
  final_role := CASE
    WHEN requested IN ('coach', 'coach_pending') THEN 'coach_pending'::user_role
    ELSE 'client'::user_role
  END;

  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    final_role
  );
  RETURN NEW;
END;
$$;

-- El invite-client (service role) sigue funcionando: crea al usuario y luego
-- hace UPDATE del rol a 'client' + coach_id, saltándose RLS con la service key.
