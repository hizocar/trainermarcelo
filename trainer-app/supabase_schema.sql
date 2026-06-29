-- ============================================================
-- Trainer App — Supabase Schema
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- Tipos personalizados
CREATE TYPE user_role AS ENUM ('coach', 'client');
CREATE TYPE unit_type AS ENUM ('kg', 'lb');

-- Tabla de usuarios (extiende auth.users)
CREATE TABLE public.users (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  role        user_role NOT NULL DEFAULT 'client',
  coach_id    uuid REFERENCES public.users(id),
  email       text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- Planes de entrenamiento
CREATE TABLE public.workout_plans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  created_by  uuid NOT NULL REFERENCES public.users(id),
  created_at  timestamptz DEFAULT now()
);

-- Días de entrenamiento
CREATE TABLE public.training_days (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     uuid NOT NULL REFERENCES public.workout_plans(id) ON DELETE CASCADE,
  day_number  int NOT NULL,
  name        text NOT NULL
);

-- Ejercicios por día
CREATE TABLE public.exercises (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id              uuid NOT NULL REFERENCES public.training_days(id) ON DELETE CASCADE,
  name                text NOT NULL,
  superseries_group   text,
  reps_objective      text NOT NULL DEFAULT '8-12',
  unit                unit_type NOT NULL DEFAULT 'kg',
  ref_weight          float,
  order_index         int NOT NULL DEFAULT 0
);

-- Series por ejercicio (S1, S2, S3)
CREATE TABLE public.exercise_series (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id     uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  series_number   int NOT NULL
);

-- Registros de entrenamiento
CREATE TABLE public.workout_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id   uuid NOT NULL REFERENCES public.exercise_series(id) ON DELETE CASCADE,
  week_number int NOT NULL,
  weight      float NOT NULL,
  reps        int NOT NULL,
  logged_at   timestamptz DEFAULT now(),
  logged_by   uuid NOT NULL REFERENCES public.users(id)
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

-- Users: cada uno ve su propio perfil; coach ve sus clientes
CREATE POLICY "users_self" ON public.users
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "coach_sees_clients" ON public.users
  FOR SELECT USING (coach_id = auth.uid());

-- Planes: coach ve/edita todos los de sus clientes; cliente ve el suyo
CREATE POLICY "plans_coach" ON public.workout_plans
  FOR ALL USING (
    created_by = auth.uid() OR
    client_id = auth.uid()
  );

-- Días, ejercicios, series: accesibles si tienes acceso al plan
CREATE POLICY "days_access" ON public.training_days
  FOR SELECT USING (
    plan_id IN (
      SELECT id FROM public.workout_plans
      WHERE created_by = auth.uid() OR client_id = auth.uid()
    )
  );

CREATE POLICY "exercises_access" ON public.exercises
  FOR SELECT USING (
    day_id IN (
      SELECT id FROM public.training_days WHERE plan_id IN (
        SELECT id FROM public.workout_plans
        WHERE created_by = auth.uid() OR client_id = auth.uid()
      )
    )
  );

CREATE POLICY "series_access" ON public.exercise_series
  FOR SELECT USING (
    exercise_id IN (
      SELECT id FROM public.exercises WHERE day_id IN (
        SELECT id FROM public.training_days WHERE plan_id IN (
          SELECT id FROM public.workout_plans
          WHERE created_by = auth.uid() OR client_id = auth.uid()
        )
      )
    )
  );

-- Logs: cliente registra y ve los suyos; coach ve los de sus clientes
CREATE POLICY "logs_client" ON public.workout_logs
  FOR ALL USING (logged_by = auth.uid());

CREATE POLICY "logs_coach" ON public.workout_logs
  FOR SELECT USING (
    logged_by IN (
      SELECT id FROM public.users WHERE coach_id = auth.uid()
    )
  );

-- ============================================================
-- Trigger: crear fila en public.users al registrar en auth
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'client')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
