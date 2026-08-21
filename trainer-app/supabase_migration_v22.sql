-- v22 — los estados del marketplace faltaban en la restricción de gyms.
--
-- La v19 agregó free_month_used y free_month_ends_at, y dio por hecho dos
-- estados nuevos de suscripción: 'marketplace' (lo escribe start-free-signup)
-- y 'free_month' (lo escribe claim_request). Pero nunca tocó
-- gyms_subscription_status_check, que solo permitía los cinco estados de Flow.
--
-- Resultado: los dos caminos del marketplace fallaban con violación de
-- restricción. El registro gratis devolvía 500 y reclamar una solicitud habría
-- hecho lo mismo. No lo detectó ninguna revisión porque la restricción vive en
-- una migración vieja, no en los archivos que se revisaron; apareció al
-- ejecutar el camino feliz de punta a punta.
--
-- Ensanchar un CHECK es seguro: Postgres revalida las filas existentes y todos
-- los valores actuales están dentro del conjunto nuevo.

alter table public.gyms drop constraint if exists gyms_subscription_status_check;

alter table public.gyms add constraint gyms_subscription_status_check
  check (subscription_status in (
    -- los que escribe Flow
    'active', 'trialing', 'past_due', 'canceled', 'incomplete',
    -- los del marketplace
    'marketplace',  -- alta gratis, panel cerrado salvo /marketplace
    'free_month'    -- mes de regalo al reclamar una solicitud
  ));
