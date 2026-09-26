-- v48 (SEGURIDAD): un usuario solo puede editar su tema y su foto.
--
-- Hallazgo del 26-sep-2026, previo al registro propio: la política
-- users_self_update solo impedía cambiar role y coach_id, y el rol
-- authenticated tenía UPDATE sobre TODA la tabla users. Cualquier usuario con
-- sesión podía, por la API, ponerse is_platform_admin = true (entrar al panel
-- de negocio), aprobarse solo en el marketplace, cambiarse de gimnasio o
-- inventarse un slug. Demostrado en una transacción revertida con la cuenta
-- demo de alumno.
--
-- Auditoría antes de aplicar: los únicos admins son Sebastián y Yharel; ningún
-- desconocido aparecía aprobado ni como admin.
--
-- La app y la web editan users directamente SOLO en dos columnas: theme (app y
-- panel) y avatar_url (foto en la app). Todo lo demás pasa por funciones
-- security definer (update_my_profile, completar_registro, approve_coach…) o
-- por edge functions con service_role, que no dependen de estos permisos.
-- Tampoco hay inserts directos: la fila la crea handle_new_user.

revoke insert, update on public.users from authenticated, anon;
grant update (theme, avatar_url) on public.users to authenticated;
