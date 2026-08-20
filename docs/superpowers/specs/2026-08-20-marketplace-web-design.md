# Marketplace en la web: bolsa de solicitudes de alumnos

**Fecha:** 2026-08-20
**Estado:** diseño aprobado, sin construir
**Origen:** `docs/negocio/2026-08-18-marketplace-coach-alumno.md`
**Alcance:** solo `web/`. `trainer-app/` no se toca.

## Qué se construye

Una bolsa donde un alumno publica que busca entrenador y los coaches se postulan
para atenderlo. No es un directorio: el alumno no navega fichas ni filtra, publica
lo que busca y espera que le escriban.

La decisión de fondo es que **el alumno no crea cuenta**. Deja una solicitud con su
WhatsApp; la cuenta la sigue creando el coach con `invite-client`, igual que hoy.
Eso mantiene intacto el supuesto sobre el que está construida toda la app —que todo
alumno tiene coach— y elimina el problema del alumno huérfano en vez de resolverlo.

Se salta la etapa 0 del documento de negocio (emparejamiento a mano por WhatsApp) por
decisión del dueño el 2026-08-20.

## Corrección al documento de negocio

El documento de origen afirma que "la ficha del coach dentro de la app —foto, portada,
especialidad, Instagram— ya está construida y es prácticamente un perfil público".
**Es falso, verificado el 2026-08-20.** `trainer-app/src/screens/client/CoachProfileScreen.tsx`
es la pantalla donde el alumno mira a *su* coach y muestra `name`, `avatar_url` y `email`.
No existe portada, especialidad, Instagram ni biografía: desde el esquema original,
`public.users` solo ganó `avatar_url` (migración v6) e `is_owner` (v13). El perfil
público se construye entero acá, columnas incluidas.

## El recorrido

1. El alumno entra a `/busco-coach` y publica: nombre, WhatsApp, comuna, modalidad
   (presencial / online / ambas), objetivo y disponibilidad. Sin cuenta, sin contraseña.
2. La solicitud entra a la bolsa. Los coaches cuyo gimnasio tiene
   `subscription_status = 'active'` la ven de inmediato; el resto —gratis, `past_due`,
   `canceled`— la ve **12 horas después**.
3. Un coach aprobado se postula. **Recién ahí ve el WhatsApp** y le escribe.
   Máximo **3 postulaciones por solicitud**.
4. El alumno elige respondiéndole a quien quiera. No hay nada que apretar de su lado.
5. El coach marca "Lo tomé": la solicitud se cierra, se activa el mes gratis si es su
   primer alumno del marketplace, y se le abre el panel. Después lo invita con
   `invite-client`, que ya existe.

### Por qué la ventaja del suscrito es tiempo y no orden

"El coach con suscripción activa se muestra primero" no se puede aplicar tal cual a una
bolsa, porque no hay un listado de coaches que ordenar. Se traduce a una ventana de
ventaja: 12 horas de acceso exclusivo. Es una ventaja real y también acotada —si el
suscrito no se mueve, el coach gratis alcanza cupo—, que es justo el reparo que el
documento de negocio dejó escrito: si el orden depende *solo* de quién paga, el alumno
deja de encontrar al coach que le sirve y el canal se muere.

## Modelo de datos

Todo en Supabase. Las migraciones del repo van en `trainer-app/supabase_migration_v19.sql`,
siguiendo la numeración existente (la última es v18).

```sql
create table public.coach_requests (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  whatsapp          text not null,          -- normalizado a +569XXXXXXXX
  comuna            text not null,
  modality          text not null check (modality in ('presencial','online','ambas')),
  goal              text not null,
  availability      text,
  status            text not null default 'open'
                    check (status in ('open','matched','closed','expired')),
  matched_coach_id  uuid references public.users(id),
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null default now() + interval '21 days'
);

create table public.request_applications (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.coach_requests(id) on delete cascade,
  coach_id    uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (request_id, coach_id)
);

alter table public.users
  add column if not exists marketplace_status text
      check (marketplace_status in ('pending','approved','rejected')),
  add column if not exists is_platform_admin boolean not null default false;

alter table public.gyms
  add column if not exists free_month_used   boolean not null default false,
  add column if not exists free_month_ends_at timestamptz;
```

`marketplace_status` es nulo para los coaches que ya existen; el guard los trata como
aprobados, porque llegaron pagando. Solo el registro gratis lo deja en `'pending'`.

`is_platform_admin` se enciende a mano por SQL para el dueño. No se deriva de
`is_owner` —eso es ser dueño de *un gimnasio*, no de la plataforma— ni de una lista de
correos en el código, que es una credencial en el repositorio.

### Perfil público del coach

```sql
alter table public.users
  add column if not exists slug text unique,
  add column if not exists bio text,
  add column if not exists instagram text,
  add column if not exists specialties text[],
  add column if not exists comunas text[],
  add column if not exists modality text
      check (modality in ('presencial','online','ambas')),
  add column if not exists accepting_clients boolean not null default true;
```

`slug` se genera del nombre al aprobar al coach (`marcelo-herrera`), con sufijo numérico
si choca. Es `unique`, así que la colisión la resuelve la base y no una comprobación
previa que dos registros simultáneos pueden pasar los dos.

## La privacidad del WhatsApp

Es la pieza que sostiene el diseño y por eso no se resuelve con una política de RLS:
**RLS en Postgres es por fila, no por columna**, y una política que deje leer
`coach_requests` deja leer el teléfono.

- Los coaches leen la vista `public.open_requests`, que **no contiene la columna
  `whatsapp`**. Devuelve las solicitudes `open` no expiradas, con los cupos restantes,
  y aplica la ventana de 12 h según el estado de suscripción de quien consulta
  (`auth.uid()` dentro de la vista). La vista se crea **sin `security_invoker`**, para
  que pueda leer una tabla que no tiene política de lectura para nadie; su cláusula
  `where` es entonces la única autorización, y por eso filtra explícitamente por coach
  aprobado y no delega eso al llamador.
- El número sale **únicamente** por `public.apply_to_request(p_request_id uuid)`,
  en `security definer`, que en una sola transacción:
  1. verifica que quien llama sea un coach con `marketplace_status` aprobado (o nulo);
  2. verifica que la solicitud siga `open` y no expirada;
  3. verifica la ventana de 12 h para ese coach;
  4. bloquea la fila (`select … for update`) y cuenta las postulaciones: si ya hay 3,
     aborta;
  5. inserta la postulación y devuelve el WhatsApp.

El tope de 3 vive en esa función y en el `unique (request_id, coach_id)`. Chequearlo en
React no sirve: dos pestañas abiertas lo pasan, y el precio de pasarlo es un teléfono
real entregado de más.

`coach_requests` sin la vista queda sin política de lectura para nadie: el formulario
público escribe por `public.create_request(...)`, también `security definer`, que
normaliza el número, rechaza un segundo pedido abierto del mismo WhatsApp y aplica el
límite por número. No hay `insert` directo con la anon key.

## Páginas

Todas siguen el lenguaje visual de la landing: fondo `#00030d`, Anton en los títulos,
mono en las cifras, y **ningún color salvo el ámbar `#C9A227`** reservado para lo que
exige acción del coach —acá, una solicitud nueva que todavía tiene cupo.

### Públicas

- **`/busco-coach`** — el formulario. Una columna, seis campos, un botón. La
  confirmación no dice "gracias": dice *"Listo. En las próximas horas te va a escribir
  un entrenador por WhatsApp"*. Fijar esa expectativa antes de que llegue el mensaje de
  un desconocido es parte de la función de la página.
- **`/coach/[slug]`** — el perfil público. Foto, nombre, comunas, modalidad,
  especialidades, biografía corta e Instagram. Cumple dos funciones: es lo que el coach
  comparte en sus redes y es el enlace que va **dentro de su primer WhatsApp**, para que
  el alumno sepa quién le escribió. Devuelve 404 si el coach no está aprobado.
- **`/registro-coach`** — registro gratis, sin tarjeta y sin pasar por Flow. No toca
  `/signup`, que sigue siendo el camino que cobra.

### Con sesión de coach

- **`/marketplace`** — la bolsa. Cada solicitud muestra comuna, modalidad, objetivo,
  disponibilidad, hace cuánto se publicó y los cupos restantes ("2 de 3"). "Postularme"
  pide confirmación; al aceptar revela el número junto a un enlace `wa.me` con el
  mensaje ya escrito, incluyendo su link de perfil. Debajo, sus postulaciones activas
  con dos salidas: **"Lo tomé"** y "No respondió".
- **`/perfil`** — donde el coach edita lo que se ve en su página pública.
- **`/admin/coaches`** — la cola de aprobación: nombre, correo, Instagram, aprobar o
  rechazar. Protegida por `is_platform_admin`.

### El bloqueo del coach gratis

Un solo guard en el layout autenticado: si el gimnasio está en `subscription_status =
'marketplace'` y todavía no tomó a nadie, cualquier ruta del panel redirige a
`/marketplace`. Un guard, no una condición repartida por página.

## Registro gratis y mes de regalo

`/registro-coach` llama a una Edge Function nueva, `start-free-signup`, hermana de
`start-signup` pero sin cobro: crea el usuario de auth, la fila en `users` con
`role='coach'` y `marketplace_status='pending'`, y un gimnasio con
`subscription_status='marketplace'`, `plan_tier='solo'`, `coach_limit=1`.

Las Edge Functions **no están en este repositorio** —viven en el proyecto de Supabase—
y el panel web solo usa la `ANON_KEY`. Crear cuentas exige el service role, así que esta
función se escribe y despliega en Supabase, no como ruta de Next.

Al marcar "Lo tomé", una función `claim_request(p_request_id uuid)` cierra la solicitud
(`status='matched'`, `matched_coach_id`) y, si el gimnasio tiene `free_month_used=false`,
lo pone en `true`, deja `subscription_status='active'` y escribe
`free_month_ends_at = now() + interval '1 month'`. **Una sola vez por gimnasio**, no por
alumno.

El vencimiento no lo apaga ningún proceso en background —no hay ninguno— sino el mismo
guard: un gimnasio con `free_month_ends_at` en el pasado y sin pago registrado se trata
como expirado, igual que `coach_requests.expires_at` decide sin que corra nada. Hoy el
código solo lee `gyms.subscription_status`; `free_month_ends_at` es una columna nueva
precisamente porque esa fecha no existe en ninguna parte.

La verificación de que el alumno era realmente del marketplace sigue siendo a mano. Con
la regla de un solo mes, el techo de una trampa es un mes por coach para siempre, y a
esta escala no justifica construir atribución.

## Reglas de borde

- La solicitud expira a los **21 días**: la vista deja de mostrarla, sin necesidad de un
  proceso que corra en background.
- Un mismo WhatsApp no puede tener dos solicitudes `open`.
- El formulario lleva honeypot y límite por número. **No** se usa captcha de terceros:
  choca con la CSP y agrega un proveedor más.
- Si dos coaches se postulan a la vez y queda un cupo, el que pierde ve *"esta solicitud
  ya se llenó"* **sin ver el número** — la transacción aborta antes de devolverlo.
- Un coach `rejected` ve la bolsa vacía. No se le explica por qué.

## Pruebas

La lógica pura va a `web/src/lib/marketplace.ts` con Vitest, que ya está configurado:

- normalización del WhatsApp chileno: `9 1234 5678`, `+56 9 1234 5678`, `56912345678`,
  `9.1234.5678`, `(9) 1234-5678` → `+56912345678`; y el rechazo de lo que no es un móvil
  chileno;
- la ventana de 12 h dado `created_at` y el estado de suscripción;
- los cupos restantes dada la cuenta de postulaciones.

Los invariantes que de verdad protegen —cupo, ventana, aprobación, unicidad del slug—
viven en SQL y ningún test de Vitest los cubre. El plan incluye un paso explícito de
verificación contra el proyecto de Supabase: postular cuatro veces, postular sin
aprobación, postular dentro de la ventana, y confirmar que ninguna devuelve el teléfono.

## Lo que no se construye

Reseñas ni calificaciones, chat interno, pagos entre alumno y coach, buscador con filtros
para el alumno, listado navegable de coaches, cambio de coach, notificaciones por correo
—no hay proveedor de correo en el proyecto y agregarlo es un proyecto aparte— y ningún
cambio en `trainer-app/`.

## Cómo se mide

Dos preguntas separadas, como pide el documento de negocio:

1. **¿El canal trae gente?** Solicitudes publicadas, postulaciones, solicitudes tomadas.
2. **¿El producto convence?** Cuántos coaches siguen pagando después del mes gratis.

Un coach que no renueva no significa que el canal falle. Las dos cifras se miran en
`/admin/coaches`, en una sola tabla, sin sumarlas.
