-- v32 — regalar el panel: el administrador le da meses gratis a un coach.
--
-- No inventa un estado nuevo: usa 'free_month', el mismo del marketplace,
-- con la fecha que el admin decida. Eso hereda TODO lo ya construido: el
-- panel se abre hasta free_month_ends_at, la app lo respeta (lista blanca),
-- y al vencer aparece el momento de conversión ("GESTIONAR SUSCRIPCIÓN").
-- Y si el coach paga de verdad, el webhook de Flow escribe 'active' encima
-- y gana por construcción — el diseño de la v19, intacto.
--
-- Un regalo con fecha es mejor que un 'active' puesto a mano para siempre:
-- el 'active' eterno no convierte nunca (los betas son la prueba).

create or replace function public.regalar_panel(p_coach_email text, p_dias int)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_coach public.users%rowtype;
  v_gym   public.gyms%rowtype;
  v_hasta timestamptz;
begin
  if not exists (select 1 from public.users me
                  where me.id = auth.uid() and me.is_platform_admin) then
    raise exception 'solo el administrador puede regalar' using errcode = '42501';
  end if;

  if p_dias is null or p_dias < 1 or p_dias > 365 then
    raise exception 'los días del regalo van de 1 a 365' using errcode = 'P0001';
  end if;

  select * into v_coach from public.users
   where lower(email) = lower(trim(p_coach_email)) and role = 'coach';
  if not found then
    raise exception 'no hay un coach con ese correo' using errcode = 'P0002';
  end if;
  if v_coach.gym_id is null then
    raise exception 'ese coach no tiene gimnasio' using errcode = 'P0002';
  end if;

  select * into v_gym from public.gyms where id = v_coach.gym_id;

  -- a quien YA paga por Flow no se le regala encima: el regalo le pisaría la
  -- suscripción real y el vencimiento lo dejaría fuera pagando.
  if v_gym.flow_subscription_id is not null
     and v_gym.subscription_status in ('active', 'trialing') then
    raise exception 'ese gimnasio ya paga por Flow — no necesita regalo'
      using errcode = 'P0003';
  end if;

  v_hasta := now() + make_interval(days => p_dias);

  update public.gyms
     set subscription_status = 'free_month',
         free_month_ends_at = v_hasta,
         free_month_used = true
   where id = v_gym.id;

  return v_gym.name || ' con panel completo hasta ' || to_char(v_hasta, 'DD-MM-YYYY');
end;
$$;

revoke execute on function public.regalar_panel(text, int) from public, anon;
grant execute on function public.regalar_panel(text, int) to authenticated;
