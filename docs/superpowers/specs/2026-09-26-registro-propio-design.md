# Registro propio — diseño (proyecto 1 de 4)

Fecha: 26 de septiembre de 2026 · Estado: **aprobado en conversación, pendiente de revisión escrita**

## Contexto: el cambio de modelo

Hasta hoy la app no permite crear cuentas. Los coaches se registran en la web
eligiendo un plan pagado, y los alumnos los crea su coach con "+ Cliente". Quien
descarga la app desde la tienda sin tener coach no puede hacer nada.

El nuevo modelo, definido por Sebastián:

1. **Coach y alumno siempre se registran solos.** El coach ya no crea cuentas,
   pero puede **invitar** a un alumno para ligarse directamente.
2. El **alumno** arma su propia rutina o **busca coach** en el marketplace:
   puede pedírselo a varios, pero hace match con uno solo. El coach puede rechazar.
3. El **coach** guía hasta **5 alumnos** durante sus **3 meses gratis**, y puede
   conseguir alumnos nuevos por solicitudes.
4. Después de los 3 meses, el coach **paga por usar la app** (cobro por la web,
   nunca dentro de la app, por las reglas de Apple y Google).
5. Un **panel de admin** para Sebastián con el progreso de coaches, alumnos,
   matches y el uso de app y web.

Se divide en cuatro proyectos, cada uno con su diseño, plan e implementación:

| # | Proyecto | Depende de |
|---|---|---|
| **1** | **Registro propio** (este documento) | — |
| 2 | Match en la app: buscar coach, solicitudes, invitaciones, un solo match | 1 |
| 3 | Panel de admin | 1, 2 |
| 4 | Cobro al terminar la prueba | 1 |

## Decisiones tomadas

Todas confirmadas por Sebastián. Las de los proyectos 2 a 4 se anotan acá para
que no se pierdan.

| Tema | Decisión |
|---|---|
| Dónde se registra cada uno | **La web es solo para coaches.** El alumno se registra y entrena solo en la app. El coach puede registrarse en la app o en la web. |
| Cuándo se elige el rol | **Primero la identidad, después el rol** (enfoque 1): una pantalla obligatoria después de crear la cuenta, igual para correo, Google y Apple. |
| Perfil de coach | **Obligatorio** para todo coach (lo ven sus alumnos). **Aparecer en el buscador** es opcional, con un interruptor encendido por defecto. |
| Qué bloquea la aprobación de Sebastián | **Solo aparecer en el buscador.** El coach trabaja con sus propios alumnos desde el primer día. |
| Límite de 5 alumnos | Rige **durante los 3 meses gratis**; después depende del plan pagado. *(proyecto 4)* |
| Desde cuándo corren los 3 meses | **Desde el registro de cada coach.** Los coaches actuales empiezan a contar el **día del lanzamiento**. |
| Invitación del coach al alumno | **Enlace para compartir y correo automático**, las dos vías. *(proyecto 2)* |
| Solicitudes del alumno | Puede pedírselo a **varios coaches**; hace **match con uno solo**; el coach puede **rechazar**. *(proyecto 2)* |
| Panel de admin | Incluye la **lista de coaches registrados** para aprobar y modificar, además del progreso de coaches, alumnos y matches. *(proyecto 3)* |

## 1. El recorrido

### En la app, para cualquiera

1. **Bienvenida** → *Crear cuenta* o *Ya tengo cuenta*.
2. **Crear cuenta** con correo y clave, *Continuar con Google* o, solo en iPhone,
   *Continuar con Apple*.
3. **Pantalla obligatoria**, antes de ver cualquier otra cosa:
   - *¿Cómo vas a usar EliteFitness?* → **Quiero entrenar** / **Soy entrenador**
   - *¿Cómo te llamas?*

### Si eligió "Quiero entrenar"

Llega a su inicio con dos caminos: **Armar mi rutina** (lo que ya existe hoy) y
**Buscar coach**. Este último se activa con el proyecto 2; mientras tanto no se
muestra.

### Si eligió "Soy entrenador"

Un paso más: **su perfil de coach**, corto para completarlo desde el teléfono.

- **Obligatorio:** foto, descripción breve, al menos una especialidad y
  modalidad (online, presencial o ambas; si es presencial, sus comunas).
- **Opcional:** Instagram.
- **Interruptor "Aparecer en el buscador"**, encendido por defecto:
  - encendido → el perfil entra a la cola de aprobación de Sebastián y aparece
    en el buscador al aprobarse;
  - apagado → el perfil existe y solo lo ven sus alumnos; puede encenderlo después.

Al terminar empiezan sus **3 meses gratis** con hasta **5 alumnos**. Su inicio
muestra, mientras corresponda: *"Tu perfil está en revisión para aparecer en el
buscador"*. Ya puede armar planes e invitar alumnos.

### En la web (solo coaches)

El mismo recorrido de coach: crear cuenta (correo con código o Google), nombre,
perfil, y entra a su panel con la prueba corriendo. **El registro deja de pedir
plan**: el plan se elige al terminar la prueba (proyecto 4).

### Cuentas que ya existen

- No les cambia nada: ya tienen rol, nombre y clave.
- Si su nombre guardado es su correo (caso Yharel), se les pide el nombre **una vez**.
- Los coaches actuales cuyo perfil esté incompleto lo completan al entrar la
  próxima vez.

## 2. Las reglas por detrás

### El rol lo fija el servidor

Hoy `handle_new_user` lee el rol desde los metadatos del registro, que manda el
cliente: alguien con conocimientos podría crearse una cuenta de coach sin pasar
por el recorrido. En el diseño nuevo:

- **Toda cuenta nace sin completar** (`users.registro_completo = false`) y con
  rol de alumno. `handle_new_user` deja de leer el rol desde los metadatos.
- La pantalla obligatoria llama a **`completar_registro(p_rol, p_nombre)`**
  (`security definer`), que:
  - solo funciona si `registro_completo = false` → **una sola vez**;
  - acepta únicamente `'alumno'` (rol `client`) o `'coach'` (rol `coach`), nunca
    admin. El coach recibe `coach` **directo**, sin pasar por `coach_pending`: la
    aprobación de Sebastián ya no bloquea el uso, solo el buscador;
  - valida el nombre con las reglas de v44 (2 a 60 caracteres, sin "@");
  - si es coach, **en la misma transacción** crea su espacio de trabajo (una fila
    en `gyms` con `subscription_status = 'trialing'` —estado que la restricción
    de `gyms` ya admite—, `trial_ends_at = now() + 3 meses`
    y `alumnos_max = 5`) y deja su perfil en estado inicial;
  - marca `registro_completo = true`.
- Las cuentas existentes se migran con `registro_completo = true`.

### El perfil de coach

- **"Perfil completo"** tiene una sola definición, en la base: una columna
  generada `users.perfil_coach_completo` (foto, descripción, al menos una
  especialidad y al menos una modalidad). La app y la web preguntan por esa
  columna para decidir si el coach puede pasar.
- **Aparecer en el buscador** (decisión del coach) y **estar aprobado** (decisión
  de Sebastián) son dos datos distintos:
  - `users.en_buscador boolean` — el interruptor del coach;
  - `users.marketplace_status` — la aprobación (`pending` / `approved` / `rejected`, ya existe).
- El directorio público muestra solo a los coaches **aprobados y con
  `en_buscador = true`**.
- Encender el interruptor sin estar aprobado deja el perfil en `pending` (entra
  a la cola). Apagarlo no cambia la aprobación: al volver a encenderlo, un coach
  ya aprobado reaparece sin pasar de nuevo por la cola.

### El límite de 5 alumnos

- Vive en `gyms.alumnos_max` y se **hace cumplir en el servidor**, en la función
  que liga a un alumno con su coach (proyecto 2), nunca en la pantalla.
- Si un coach ya tuviera más alumnos que su límite antes del cambio, los conserva
  todos; el límite solo impide sumar nuevos. *(Hoy nadie lo supera: el máximo es
  4.)*

### Coaches actuales

Sus espacios pasan a `trialing` con `trial_ends_at = fecha de lanzamiento + 3 meses`
y `alumnos_max = 5`. **La fecha de lanzamiento la define Sebastián antes de
aplicar la migración.**

### Verificación del correo con código

- Al crear cuenta con correo y clave, llega un **código de 6 dígitos** que la
  persona escribe en la app o en la web. Se usa código y no enlace porque los
  enlaces de verificación suelen abrirse en el navegador y no en la app.
- Requiere: activar la confirmación de correo en Supabase Auth y cambiar la
  plantilla del correo para que muestre el código (`{{ .Token }}`).
- Con Google y Apple no se pide: el correo ya viene verificado.

### Envío de correos (requisito previo)

El envío que trae Supabase por defecto tiene un límite de pocos correos por
hora y es para pruebas. Con registro abierto al público, los códigos dejarían de
llegar. **Hay que conectar un servicio de envío transaccional** (SMTP propio) con
el dominio `elitefitapp.com` y sus registros SPF/DKIM. El mismo servicio envía
las invitaciones del proyecto 2 y permite un remitente de marca
(`soporte@elitefitapp.com` o similar).

## 3. Formas de ingresar

| | App iPhone | App Android | Web (coach) |
|---|---|---|---|
| Correo y clave, con código | ✅ | ✅ | ✅ |
| Google | ✅ | ✅ | ✅ |
| Apple | ✅ | — | — |

- Apple va solo en iPhone: allí es obligatoria porque se ofrece Google. En la
  web no se agrega.
- En la app, Google y Apple usan el inicio de sesión **nativo** y entregan el
  token a Supabase (`signInWithIdToken`), sin abrir el navegador.
- **Cuentas existentes:** entrar con Google usando el mismo correo lleva a **la
  misma cuenta** (Supabase liga identidades con correo verificado).
- **Borrar cuenta creada con Apple:** Apple exige revocar el acceso al borrar la
  cuenta. `delete-account` suma esa llamada cuando el usuario tiene identidad de Apple.

### Lo que configura Sebastián (con guía paso a paso)

1. **Servicio de envío de correos** con el dominio `elitefitapp.com`.
2. **Google Cloud:** pantalla de consentimiento (nombre, logo, dominio y política
   de privacidad) y tres credenciales: web, iPhone y Android. La de Android
   necesita la huella de la firma de Google Play: se completa después de crear
   la cuenta de Play Console.
3. **Apple Developer:** activar "Iniciar sesión con Apple" y generar la clave
   para revocar tokens.
4. **Supabase:** cargar esas credenciales (puede hacerlo Claude si recibe los
   datos por un canal seguro).

## 4. Errores y casos límite

| Situación | Qué ve la persona |
|---|---|
| No le llega el código | *Reenviar código*, con espera de 60 segundos |
| El correo ya tiene cuenta | *"Ese correo ya tiene una cuenta"* con botón para iniciar sesión |
| Cierra la app a mitad del registro | Al volver, retoma la pantalla que le faltaba: una cuenta sin completar siempre vuelve ahí |
| Nombre inválido | Mismas reglas y mensajes que el perfil web |
| Falla la subida de la foto de coach | Conserva lo escrito y permite reintentar |
| Sin señal | Aviso de que el registro necesita conexión, sin perder lo escrito |
| Intenta completar el registro dos veces | El servidor lo rechaza; la app lo lleva a su inicio |

## 5. Cómo se prueba

- **`completar_registro`**, ensayada en transacciones revertidas: alumno; coach
  (espacio con prueba y límite, perfil inicial); intento de completar dos veces;
  intento de asignarse un rol no permitido; nombre inválido.
- **Directorio:** un coach aprobado con `en_buscador = false` no aparece; al
  encenderlo reaparece sin volver a la cola.
- **De punta a punta** con cuentas desechables, creadas y borradas en la prueba
  (código de correo obtenido por la API de administración).
- **Web:** en el navegador, con el build de producción local.
- **App:** la lógica pura con tests; las pantallas se revisan al armar el build
  (el proyecto no tiene cómo renderizarlas en tests). Queda en la lista de
  pendientes de la versión.

## 6. Orden de entrega

1. **Servidor:** migración (`registro_completo`, `en_buscador`,
   `perfil_coach_completo`, `trial_ends_at`, `alumnos_max`), cambio de
   `handle_new_user` y `completar_registro`.
2. **Web:** registro nuevo de coach sin elegir plan, con el mismo recorrido. Se
   publica al tiro.
3. **App:** bienvenida, registro con código, pantalla obligatoria y perfil de
   coach. Sale con la próxima versión, sin build suelto.
4. **Google y Apple**, cuando estén las credenciales.

El envío de correos (§2) debe estar listo **antes** de abrir el registro con
correo al público.

## Fuera de este proyecto

- Buscar coach, solicitudes, invitaciones y match → proyecto 2.
- Panel de admin → proyecto 3.
- Cobro al terminar la prueba y qué pasa si el coach no paga → proyecto 4.
- El alumno en la web: no existe; la web es solo para coaches.
