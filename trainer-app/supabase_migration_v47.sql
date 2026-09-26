-- v47: borrar la cuenta propia (exigido por Google Play y por Apple apenas la
-- app permite crear cuentas).
--
-- Un simple auth.admin.deleteUser FALLABA: muchas tablas referencian al
-- usuario con NO ACTION (sesiones, citas, fichas de salud, reseñas, eventos;
-- y en el coach: sus alumnos, los planes y registros que tecleó por ellos, su
-- biblioteca y su gimnasio). Esta función deja todo en orden y borra en UNA
-- transacción: o se va todo, o no se toca nada.
--
-- Decisión de Sebastián (26-sep-2026): si un COACH borra su cuenta, sus
-- alumnos CONSERVAN su cuenta, su plan y su historial, y quedan "sin coach".
--
-- Bloqueos (se avisa, no se borra nada):
--   · suscripcion_activa      — hay un cobro recurrente en Flow: se cancela
--                               primero, o Flow seguiría cobrando.
--   · gimnasio_con_otros_coaches — el gimnasio tiene más coaches: hay que
--                               traspasarlo antes (lo resuelve soporte).
--
-- Devuelve los archivos a borrar del Storage (la API de Storage es la que
-- borra de verdad; la edge function delete-account se encarga).
--
-- Solo la ejecuta service_role: la edge function autentica al usuario y pasa
-- SU propio id. Nadie puede borrar la cuenta de otro desde el cliente.

create or replace function public.eliminar_cuenta(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_gym   uuid;
  v_dueno boolean;
  v_archivos jsonb;
begin
  if p_user is null then
    raise exception 'usuario requerido' using errcode = 'P0001';
  end if;

  -- ya no existe: idempotente (un reintento tras un corte no falla)
  if not exists (select 1 from public.users where id = p_user) then
    return jsonb_build_object('archivos', '[]'::jsonb);
  end if;

  select g.id, true into v_gym, v_dueno
    from public.gyms g where g.owner_id = p_user limit 1;

  -- ── bloqueos: antes de tocar nada ──
  if v_gym is not null and exists (
       select 1 from public.gyms where id = v_gym and flow_subscription_id is not null
     ) then
    raise exception 'suscripcion_activa' using errcode = 'P0001';
  end if;
  if v_gym is not null and exists (
       select 1 from public.users o
        where o.gym_id = v_gym and o.id <> p_user and o.role in ('coach', 'coach_pending')
     ) then
    raise exception 'gimnasio_con_otros_coaches' using errcode = 'P0001';
  end if;

  -- archivos a borrar del Storage, calculados ANTES de borrar las filas.
  -- avatars / exercise-media / progress-photos: la primera carpeta es el uid.
  -- chat-media: el uid puede ir en la primera o en la segunda carpeta.
  select coalesce(jsonb_agg(jsonb_build_object('bucket', o.bucket_id, 'name', o.name)), '[]'::jsonb)
    into v_archivos
    from storage.objects o
   where (o.bucket_id in ('avatars', 'exercise-media', 'progress-photos')
          and (storage.foldername(o.name))[1] = p_user::text)
      or (o.bucket_id = 'chat-media'
          and ((storage.foldername(o.name))[1] = p_user::text
               or (storage.foldername(o.name))[2] = p_user::text));

  -- ── lado COACH: sus alumnos se quedan con todo ──
  -- los registros que el coach tecleó por un alumno pasan a ser del alumno
  update public.workout_logs wl
     set logged_by = wp.client_id
    from public.exercise_series es
    join public.exercises e      on e.id = es.exercise_id
    join public.training_days d  on d.id = e.day_id
    join public.workout_plans wp on wp.id = d.plan_id
   where wl.series_id = es.id
     and wl.logged_by = p_user
     and wp.client_id <> p_user;

  -- los planes que armó para sus alumnos pasan a ser de cada alumno
  update public.workout_plans set created_by = client_id
   where created_by = p_user and client_id <> p_user;

  -- sus videos de técnica se van con él: no dejar enlaces rotos en los planes
  update public.exercises set video_url = null
   where video_url like '%/exercise-media/' || p_user::text || '/%';

  update public.users set coach_id = null where coach_id = p_user;

  -- su biblioteca privada: los ejercicios que la usan conservan nombre y datos
  update public.exercises set library_id = null
   where library_id in (select id from public.exercise_library where coach_id = p_user);
  update public.program_template_exercises set library_id = null
   where library_id in (select id from public.exercise_library where coach_id = p_user);
  delete from public.exercise_library where coach_id = p_user;

  delete from public.appointments      where coach_id = p_user or client_id = p_user;
  delete from public.coach_reviews     where coach_id = p_user or author_id = p_user;
  delete from public.coach_invitations where invited_by = p_user;
  update public.coach_requests set preferred_coach_id = null where preferred_coach_id = p_user;

  -- su gimnasio (sin otros coaches, ya comprobado): los alumnos quedan sueltos
  if v_gym is not null then
    update public.users set gym_id = null where gym_id = v_gym;
    delete from public.coach_invitations where gym_id = v_gym;
    delete from public.gyms where id = v_gym;
  end if;

  -- ── lado ALUMNO: sus propios datos ──
  delete from public.workout_sessions where user_id = p_user;
  delete from public.workout_logs     where logged_by = p_user;
  delete from public.client_forms     where client_id = p_user;
  delete from public.app_events       where user_id = p_user;

  -- el resto cuelga en CASCADE de public.users, que cuelga de auth.users:
  -- planes, semanas, días, ejercicios, series, mensajes, medidas, ánimo,
  -- notas, cardio, push, programas, plantillas, fichas del coach…
  delete from auth.users where id = p_user;

  return jsonb_build_object('archivos', v_archivos);
end;
$function$;

revoke all on function public.eliminar_cuenta(uuid) from public, anon, authenticated;
grant execute on function public.eliminar_cuenta(uuid) to service_role;
