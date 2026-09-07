-- v38 — cambiar de coach sin perder nada (pedido de Sebastián): el historial
-- del alumno (logs, sesiones, ánimo, PAR-Q, plan) cuelga del CLIENTE, y todo
-- el acceso del coach se deriva de users.coach_id en las políticas. Mover al
-- alumno es mover ese puntero: el coach nuevo ve y edita todo desde el primer
-- segundo, y el anterior pierde el acceso por construcción.
--
-- Dos bordes que sí requieren mano:
--  · la ficha privada del coach anterior (client_files) NO se hereda — era su
--    libreta; la salud del alumno vive en el PAR-Q, que sí viaja con él;
--  · las citas futuras con el coach anterior se cancelan.

create or replace function public.transferir_cliente(
  p_client_email text, p_new_coach_email text
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_cliente public.users%rowtype;
  v_nuevo   public.users%rowtype;
  v_citas   int;
begin
  if not exists (select 1 from public.users me
                  where me.id = auth.uid() and me.is_platform_admin) then
    raise exception 'solo el administrador puede transferir clientes' using errcode = '42501';
  end if;

  select * into v_cliente from public.users
   where lower(email) = lower(trim(p_client_email)) and role = 'client';
  if not found then
    raise exception 'no hay un cliente con ese correo' using errcode = 'P0002';
  end if;

  select * into v_nuevo from public.users
   where lower(email) = lower(trim(p_new_coach_email)) and role = 'coach';
  if not found then
    raise exception 'no hay un coach con ese correo' using errcode = 'P0002';
  end if;
  if v_cliente.coach_id = v_nuevo.id then
    raise exception 'ese ya es su coach' using errcode = 'P0001';
  end if;

  -- la libreta privada del coach anterior no se hereda
  delete from public.client_files where client_id = v_cliente.id;

  -- las citas futuras con el coach anterior se cancelan
  update public.appointments
     set status = 'cancelada'
   where client_id = v_cliente.id
     and (v_cliente.coach_id is null or coach_id = v_cliente.coach_id)
     and starts_at > now()
     and status not in ('cancelada')
  returning 1 into v_citas;

  update public.users
     set coach_id = v_nuevo.id,
         gym_id = v_nuevo.gym_id
   where id = v_cliente.id;

  return v_cliente.name || ' ahora entrena con ' || v_nuevo.name ||
         ' — historial y plan intactos, ficha del coach anterior borrada.';
end;
$$;

revoke execute on function public.transferir_cliente(text, text) from public, anon;
grant execute on function public.transferir_cliente(text, text) to authenticated;
