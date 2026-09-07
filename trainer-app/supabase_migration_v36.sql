-- v36 — fecha límite del plan (pedido de Marcelo): el coach fija hasta cuándo
-- corre el plan de su alumno. NULL = sin límite, el comportamiento histórico.
-- Al vencer, la app muestra "plan finalizado" en vez de repetir la última
-- semana para siempre, y el panel marca la fecha en ámbar.
-- Sin cambios de RLS: plans_coach (ALL) ya deja al coach escribirla, y la
-- rutina propia (plans_autonomo) simplemente nunca la usa.

alter table public.workout_plans add column if not exists ends_at date;
