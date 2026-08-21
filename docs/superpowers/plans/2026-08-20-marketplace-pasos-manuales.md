# Marketplace: los pasos que no puede hacer un agente

**Fecha:** 2026-08-20
**Rama:** `marketplace-web` (16 commits + la ola de arreglos de la revisión final)
**Estado del código:** completo, revisado tarea por tarea y en revisión final de rama.

Todo lo que sigue toca la base de datos o el proyecto de Supabase, que no están en este
repositorio y a los que ningún agente de esta sesión tuvo acceso. **El orden importa** y
el último paso es el merge, no el primero.

## ESTADO REAL, verificado el 2026-08-20 19:30 ejecutando SQL contra la base

Reemplaza la nota anterior, que decía que `v19` y `v20` ya estaban aplicadas. **No lo
estaban.** `information_schema` devolvió cero tablas, cero vistas, cero funciones y cero
columnas nuevas; después de aplicarlas aparecieron todas. La comprobación anterior se
hizo por la API REST, que no distingue bien ese caso.

**Pasos 1 a 5: hechos y verificados.**

- `v19` y `v20` aplicadas, **byte a byte idénticas** a las de esta rama. `claim_request`
  en la base trae la corrección crítica: se verificó con `pg_get_functiondef` que contiene
  el estado `'free_month'` y la guarda `subscription_status = 'marketplace'`.
- **Paso 4 encontró una alarma real:** `update_my_profile` quedaba ejecutable por `anon`.
  Causa: los *default privileges* de Supabase otorgan `EXECUTE` a `anon` explícitamente
  (`pg_default_acl` = `{postgres=X,anon=X,authenticated=X,service_role=X}`), y
  `revoke … from public` no toca esa concesión. Ya se revocó en la base y **se corrigió
  el origen** en `v20` (`from public, anon`), que si no reaparecía al reaplicar.
- **Paso 5 pasa entero.** Con una solicitud real dentro de `coach_requests`, la anon key
  recibe `[]` y `open_requests` devuelve `42501`. Los tres rechazos fallan por su razón
  correcta: `P0001 solicitud inválida`, `P0001 teléfono inválido`, `P0005 ya tienes una
  solicitud abierta`. La fila de prueba se borró.

**El paso 3 estaba mal escrito y habría fallado en silencio.** `hizocar@gmail.com` no
existe en `public.users`, y la cuenta con la que el dueño entra —`sebastian@trainerapp.com`—
tiene `role = 'client'`. Marcarla no habría servido: `requireAdmin` delega en
`requireCoach`, que corta con `role !== 'coach'` **antes** de mirar el flag, y redirige a
`/login`, que se lee como sesión caída. El admin quedó, por ahora, en la cuenta de semilla
`owner2.1785701635957@trainerapp.com`. **Es de semilla, con la contraseña de
`SEED_COACH_PASSWORD`: hay que moverlo a una cuenta real con `role = 'coach'` antes del
primer coach del marketplace.**

**El paso 6 de más abajo describe mal la función.** Tres defectos, corregidos en
`trainer-app/supabase/functions/start-free-signup/index.ts`, que ya está escrita:

1. Decía "**insertar** en `users`". El disparador `handle_new_user` (`AFTER INSERT ON
   auth.users`) ya inserta esa fila: el insert habría chocado con clave duplicada.
   Va `update`, como hace `invite-coach`.
2. El disparador nunca escribe `'coach'` — mapea `'coach'` y `'coach_pending'` a
   `'coach_pending'`, y `requireCoach` compara por igualdad. Sin el `update` a `'coach'`,
   el coach del marketplace no llega ni a `/marketplace`.
3. El insert del gimnasio que describe omite `owner_id`, que es **NOT NULL**.

Usa `inviteUserByEmail` en vez de `createUser` + `resetPasswordForEmail`: es una sola
llamada, es lo que ya usa `confirm-signup`, y así el correo es el mismo que reciben los
que pagan. Sobre la pregunta abierta de las cuentas huérfanas: deshace los pasos
anteriores si alguno falla, y borra `public.users` a mano porque **no cuelga de
`auth.users` con cascade**, y antes que el gimnasio porque `users_gym_id_fkey` es
`NO ACTION`.

**Lo que falta:** desplegar la función
(`supabase functions deploy start-free-signup --no-verify-jwt`), probar el alta gratis
de punta a punta, y el merge. Sin Deno instalado no se pudo verificar tipos localmente.

---

## Por qué el orden no es negociable

`web/src/lib/guard.ts` consulta `users.marketplace_status`, `users.is_platform_admin` y
`users.slug`, y lo hace con `if (error) throw error`. Esas tres columnas las crea `v19`.
Si la rama se mezcla antes de aplicar la migración, PostgREST responde error de columna
inexistente y **`/dashboard`, `/library`, `/programs` y `/subscription` devuelven 500 en
elitefitapp.com**, para los seis coaches beta, de inmediato. `sandbox` despliega solo.

---

## 1. Aplicar `trainer-app/supabase_migration_v19.sql`

Pegar el archivo completo en el SQL Editor del proyecto. Esperado: `Success. No rows returned`.

Crea `coach_requests` y `request_applications` (ambas con RLS y **sin ninguna política**,
a propósito), las columnas nuevas de `users` y `gyms`, las vistas `open_requests`,
`my_applications` y `pending_coaches`, y las funciones `create_request`,
`apply_to_request`, `claim_request`, `approve_coach` y `reject_coach`.

## 2. Aplicar `trainer-app/supabase_migration_v20.sql`

Igual. Crea la vista pública `public_coaches`, la función `update_my_profile` y la vista
`marketplace_stats`.

## 3. Encenderte como administrador de la plataforma

Sin esto, `/admin/coaches` te redirige a `/dashboard` y **no hay forma de aprobar a
ningún coach del marketplace**: se quedan todos en `pending` para siempre.

```sql
update public.users set is_platform_admin = true where email = 'hizocar@gmail.com';
select id, email, is_platform_admin from public.users where is_platform_admin;
```

Esperado: una fila.

## 4. Comprobar que los permisos quedaron cerrados

En Postgres, `EXECUTE` se otorga a `PUBLIC` por defecto y un `grant … to authenticated`
**suma**, no reemplaza. Las migraciones traen los `revoke` explícitos; esta consulta
confirma que quedaron aplicados.

```sql
select
  p.routine_name,
  p.grantee,
  p.privilege_type,
  case
    when upper(p.grantee) = 'PUBLIC'
      then 'ALARMA: función expuesta a PUBLIC — el revoke NO se ejecutó'
    when p.grantee = 'anon' and p.routine_name <> 'create_request'
      then 'ALARMA: ' || p.routine_name || ' tiene EXECUTE para anon'
    else 'OK'
  end as estado
from information_schema.routine_privileges p
where p.routine_schema = 'public'
  and p.routine_name in (
    'is_marketplace_coach','coach_sub_status','create_request','apply_to_request',
    'claim_request','approve_coach','reject_coach','update_my_profile'
  )
order by p.routine_name, p.grantee;
```

`create_request` **debe** tener `anon`: es el formulario público. Cualquier otra fila con
`anon`, o cualquier fila con `PUBLIC`, es una alarma.

## 5. Probar los invariantes a mano

Esto es lo único que valida de verdad el corazón del diseño —que el teléfono de una
persona sin cuenta no llegue a nadie antes de que haya una postulación registrada—.
Las revisiones fueron por lectura; ninguna ejecutó SQL.

```sql
-- 5.1 Crear una solicitud de prueba.
select public.create_request('Prueba QA','+56911112222','Ñuñoa','ambas',
  'Quiero bajar de peso y ordenar mi entrenamiento','Tardes', '');

-- 5.2 El honeypot rechaza. Esperado: ERROR "solicitud inválida"
select public.create_request('Bot','+56911113333','Ñuñoa','online',
  'texto suficientemente largo para pasar','', 'soy-un-bot');

-- 5.3 Teléfono sin normalizar rechazado. Esperado: ERROR "teléfono inválido"
select public.create_request('Malo','912345678','Ñuñoa','online',
  'texto suficientemente largo para pasar','', '');

-- 5.4 Segunda solicitud abierta del mismo número. Esperado: ERROR "ya tienes una solicitud abierta"
select public.create_request('Prueba QA','+56911112222','Ñuñoa','online',
  'otro texto suficientemente largo','', '');
```

Y desde el navegador, **en incógnito**, con la URL y la anon key del proyecto:

```js
await (await fetch('<SUPABASE_URL>/rest/v1/coach_requests?select=whatsapp',
  { headers: { apikey: '<ANON_KEY>' } })).text()
```

Debe devolver un error de permisos o una lista vacía. **Si devuelve un teléfono, no
mezclar.**

## 6. Escribir y desplegar la Edge Function `start-free-signup`

Es lo único que falta para que el registro gratis funcione. La opción "Gratis ·
marketplace" ya está en `/signup` y hasta que esta función exista falla con 404.

Copiar `start-signup` desde el panel de Supabase y adaptarla. Recibe
`{ "name": "…", "email": "…", "gymName": "…" }` — sin `planTier` ni `billing` — y con el
service role, **sin ninguna llamada a Flow**:

1. `auth.admin.createUser({ email, email_confirm: true })` y enviar el correo de definir
   contraseña con `resetPasswordForEmail` apuntando a `/set-password`, que ya existe.
2. Insertar el gimnasio: `{ name: gymName, plan_tier: 'solo', coach_limit: 1,
   subscription_status: 'marketplace', free_month_used: false }`.
   `plan_tier: 'solo'` es intencional: lo que distingue a la cuenta gratis es el
   `subscription_status`, no el plan.
3. Insertar en `users`: `{ id: <del usuario recién creado>, name, email, role: 'coach',
   is_owner: true, gym_id: <del gimnasio>, marketplace_status: 'pending' }`.
4. Devolver `{ ok: true }` con 200. Si algo falla, `{ error: '<mensaje>' }` con un status
   distinto de 2xx: `/signup` ya lee `result.error` y lo muestra.

**Decide qué hacer si un paso falla después de otro** (usuario de Auth creado pero el
insert en `users` falla): sin limpieza quedan cuentas huérfanas que no pueden entrar ni
volver a registrarse con el mismo correo.

## 7. Recién ahora, mezclar la rama a `sandbox`

---

## Los estados de suscripción, después de esta rama

| `gyms.subscription_status` | Panel web | Quién lo escribe |
|---|---|---|
| `marketplace` | **cerrado** (solo `/marketplace`) | `start-free-signup` |
| `free_month` | abierto hasta que pase `free_month_ends_at` | `claim_request`, una sola vez por gimnasio |
| `active` / `trialing` | abierto; `free_month_ends_at` se ignora | Flow |
| `past_due`, `canceled`, nulo | abierto, igual que siempre | Flow |

El mes de regalo tiene **estado propio** en vez de reutilizar `active` porque
`free_month_ends_at` no la limpia nadie: si el regalo escribiera `active`, el coach que
se suscribe de verdad después del mes quedaría bloqueado para siempre por una fecha
vieja. Con un estado propio, cualquier pago real que ponga `active` gana por
construcción, sin coordinar nada con el webhook de Flow.

## Lo que queda pendiente en la app (necesita una compilación nueva)

`trainer-app/src/navigation/index.tsx:184` corta con
`!['active','trialing'].includes(user.gymStatus)`. Falta `'free_month'`: sin eso, el
coach **dentro** de su mes de regalo tiene el panel web abierto pero ve
"SUSCRIPCIÓN INACTIVA" en el iPhone. Es una línea. No corre riesgo hoy —ningún gimnasio
está en `free_month` hasta que alguien reclame su primera solicitud— pero hay que
cerrarlo **antes del primer coach del marketplace**, no después.

Va junto con la otra deuda ya anotada: esa misma pantalla le dice "SUSCRIPCIÓN INACTIVA"
al coach en estado `marketplace`, que nunca tuvo una suscripción.
