-- v27 — las cifras del negocio, visibles solo para el administrador.
--
-- No se puede maximizar lo que no se ve: hasta ahora no había UN número de
-- negocio visible en ninguna parte. Dos vistas security definer, las dos
-- protegidas por dentro con is_platform_admin (el patrón de pending_coaches):
-- para cualquier otro usuario devuelven cero filas, no un error.
--
--   admin_funnel   una fila: el embudo completo del marketplace
--   admin_pagando  una fila por plan: gimnasios que PAGAN de verdad (Flow)
--
-- Reaplicable: create or replace.

create or replace view public.admin_funnel
with (security_invoker = false) as
select
  -- demanda
  (select count(*) from public.coach_requests r
    where r.status = 'open' and r.expires_at > now())          as solicitudes_abiertas,
  (select count(*) from public.coach_requests r
    where r.status = 'matched')                                as solicitudes_tomadas,
  (select count(*) from public.coach_requests r
    where r.status = 'open' and r.expires_at <= now())         as solicitudes_vencidas,
  (select count(*) from public.coach_requests r
    where r.preferred_coach_id is not null)                    as con_coach_elegido,
  (select count(*) from public.request_applications)           as postulaciones,
  -- oferta
  (select count(*) from public.users u
    where u.marketplace_status = 'pending')                    as coaches_pendientes,
  (select count(*) from public.users u
    where u.marketplace_status = 'approved')                   as coaches_aprobados,
  (select count(*) from public.users u
    where u.marketplace_status = 'approved'
      and u.slug is not null and u.accepting_clients)          as en_directorio,
  (select count(*) from public.coach_reviews)                  as comentarios,
  -- conversión
  (select count(*) from public.gyms g
    where g.subscription_status = 'free_month'
      and g.free_month_ends_at > now())                        as regalos_corriendo,
  (select count(*) from public.gyms g
    where g.subscription_status = 'free_month'
      and g.free_month_ends_at <= now())                       as regalos_vencidos
where exists (select 1 from public.users me
              where me.id = auth.uid() and me.is_platform_admin);

grant select on public.admin_funnel to authenticated;

create or replace view public.admin_pagando
with (security_invoker = false) as
select g.plan_tier, count(*)::int as gimnasios
from public.gyms g
where g.flow_subscription_id is not null
  and g.subscription_status in ('active', 'trialing')
  and exists (select 1 from public.users me
              where me.id = auth.uid() and me.is_platform_admin)
group by g.plan_tier;

grant select on public.admin_pagando to authenticated;
