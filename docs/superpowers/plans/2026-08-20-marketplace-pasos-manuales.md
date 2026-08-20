# Marketplace: los pasos que no puede hacer un agente

**Fecha:** 2026-08-20
**Rama:** `marketplace-web` (16 commits + la ola de arreglos de la revisión final)
**Estado del código:** completo, revisado tarea por tarea y en revisión final de rama.

Todo lo que sigue toca la base de datos o el proyecto de Supabase, que no están en este
repositorio y a los que ningún agente de esta sesión tuvo acceso. **El orden importa** y
el último paso es el merge, no el primero.

## ESTADO REAL, verificado el 2026-08-20 contra la base

**Los pasos 1 y 2 ya están hechos.** `v19` y `v20` **están aplicadas**: existen
`coach_requests`, `request_applications`, `open_requests`, `public_coaches`,
`marketplace_stats` y `pending_coaches`, y las columnas nuevas de `users` y `gyms`.
Comprobado con la service key. No las volvió a aplicar nadie de esta sesión.

**Tres cosas que quedaron abiertas y que hay que resolver antes de mezclar:**

1. **No se sabe qué versión de `v19` está aplicada.** El archivo se editó tres veces
   durante las revisiones y el cuerpo de una función no se puede leer por la API REST.
   Lo que sí se verificó: los `revoke` están (como `anon`, `coach_sub_status` e
   `is_marketplace_coach` devuelven 401 mientras una consulta a tabla con la misma llave
   devuelve 200). Lo que **no** se pudo verificar es si `claim_request` trae la
   corrección crítica —el `and subscription_status = 'marketplace'` y el estado
   `'free_month'`— sin la cual un coach que **sí paga** se lleva `free_month_ends_at`
   al marcar "Lo tomé" y queda bloqueado un mes después.
   **Qué hacer:** volver a aplicar `trainer-app/supabase_migration_v19.sql` y
   `v20.sql` tal como están hoy en la rama `marketplace-web`. Se comprobó que **los dos
   son reaplicables**: no tienen ningún `create` sin `if not exists` ni `or replace`.
   Es la forma más barata de garantizar que la base coincide con lo revisado.

2. **`hizocar@gmail.com` no existía en la base**, así que el paso 3 de este documento
   —el `update ... set is_platform_admin = true`— habría afectado **cero filas sin dar
   error**, y `/admin/coaches` habría redirigido para siempre.
   El 2026-08-20 se creó el usuario de autenticación (id
   `cea1ee1d-f42b-4204-ade4-1a5a404a1f82`, contraseña inicial `EliteAdmin905eb681!`),
   pero **quedó a medio crear**: el disparador de la base le puso `role: 'client'` sin
   gimnasio. Falta crear su gimnasio y convertirla en coach dueño y admin. El SQL exacto
   está en la conversación; mientras no se haga, esa cuenta entra a la app como un
   alumno sin coach.

3. **La comprobación del teléfono sigue sin hacerse.** Con la anon key,
   `coach_requests?select=whatsapp` devuelve `200` y `[]` — pero la tabla está vacía, así
   que no distingue "sin política" de "sin filas". **Solo sirve con una solicitud
   publicada dentro.** Es la comprobación que valida el corazón del diseño.

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
