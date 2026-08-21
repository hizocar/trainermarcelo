# Registro por el coach: los pasos que no puede hacer un agente

**Fecha:** 2026-08-20
**Rama:** `coach-registra-series` (18 commits sobre `sandbox`)
**Estado del código:** completo, revisado tarea por tarea y en revisión final de rama.
**Tests:** `trainer-app` 186 en 14 archivos; `web` 54 en 3. Los dos en verde.

## El orden, que acá sí importa y es distinto al del marketplace

**La migración `v21` tiene que estar aplicada antes de que salga la compilación de la
App Store.** No al revés y no "en cualquier momento".

La razón es que sin la migración **el registro del coach falla en silencio, no con un
error**: la política `logs_client_insert` de la `v6` acepta `wp.created_by = auth.uid()`,
y el coach creó el plan, así que el insert **entra** — con `logged_by = coach`, que bajo
las políticas viejas lo deja invisible para el alumno *y* para el coach. Y en la rama de
reemplazo, `logs_client_update` deja pasar **cero filas sin devolver error**, que la app
reporta como guardado. El coach anotaría una sesión completa y no quedaría nada.

Mezclar y desplegar `web/` antes de la migración **sí es seguro**: la política `logs_coach`
de la `v5` ya acota los registros al mismo conjunto que el filtro que se quitó.

---

## 1. Antes de aplicar nada: dos comprobaciones

**Qué políticas hay hoy.** Deben ser exactamente cuatro:

```sql
select polname, polcmd from pg_policy
where polrelid = 'public.workout_logs'::regclass order by polname;
```

Esperado: `logs_client_insert` (a), `logs_client_select` (r), `logs_client_update` (w),
`logs_coach` (r). **Si aparece alguna que no esté en esa lista, detente**: significa que
la base y las migraciones del repositorio no coinciden, y la `v21` fue escrita contra las
migraciones.

**Si algún plan fue creado por un coach distinto al del alumno:**

```sql
select count(*) from public.workout_plans wp
join public.users u on u.id = wp.client_id
where u.coach_id is distinct from wp.created_by;
```

Esperado: `0`. La función nueva ancla la pertenencia en `users.coach_id`, mientras que
la política de planes de la `v6` usa `workout_plans.created_by`. En el código las dos
coinciden siempre, pero si hay filas históricas donde difieren, esos coaches verían el
plan y perderían el acceso a sus registros. **Si devuelve más de cero, avísame antes de
aplicar.**

## 2. Aplicar `trainer-app/supabase_migration_v21.sql`

Pegar el archivo completo en el SQL Editor. Esperado: `Success. No rows returned`.

**Si necesitas correrla dos veces** (por ejemplo, si la primera falla a mitad de camino):
el archivo **no es reaplicable tal cual**. Sus `drop policy if exists` cubren los nombres
viejos pero no los tres nuevos, así que la segunda corrida falla al intentar crear una
política que ya existe. Antes de reintentar, ejecuta:

```sql
drop policy if exists "logs_lectura" on public.workout_logs;
drop policy if exists "logs_insert"  on public.workout_logs;
drop policy if exists "logs_update"  on public.workout_logs;
```

## 3. Comprobar que quedó como se espera

```sql
select polname, polcmd, pg_get_expr(polqual, polrelid) as using_expr
from pg_policy where polrelid = 'public.workout_logs'::regclass
order by polname;
```

Esperado: exactamente **tres** filas —`logs_insert` (a), `logs_lectura` (r),
`logs_update` (w)— y **ninguna** que mencione `logged_by` en su `using_expr`.
(`logs_insert` sí lo menciona en su `with check`, que es correcto: exige que quien
escribe sea quien dice ser. Las políticas de inserción no tienen `using`.)

## 4. La verificación que de verdad valida esto, con dos sesiones

Ninguna revisión ejecutó SQL: todas fueron por lectura. Esto es lo único que comprueba el
corazón del diseño, y **no es opcional**.

1. Con la sesión del **alumno**: después de que su coach registre una serie, el alumno la
   ve en su Hoy y en su historial, sin ninguna marca de origen.
2. Con la sesión de **un coach que no es su coach**: no ve ni puede escribir ningún
   registro de ese plan.

## 5. Abrir el panel del coach en la web — bloqueante antes de mezclar

Este es el riesgo que queda abierto y conviene entenderlo antes de cerrar la rama.

Para arreglar la atribución de "última vez que entrenó", la consulta del panel ahora
**embebe el plan hacia arriba** (`exercise_series ( exercises ( training_days ( plan_id ) ) )`).
La sintaxis se verificó contra el esquema —cada salto tiene exactamente una clave foránea,
así que no hay ambigüedad— pero **ninguna otra consulta del repositorio embebe un padre**,
y esto no se ha probado contra la base.

Y el modo de falla importa: si PostgREST rechazara el embebido, no devolvería filas sin
atribuir — devolvería **400 y la consulta entera falla**. Como el error se propaga (que es
lo correcto), **el panel del coach no cargaría** para los seis, no solo la línea de texto.

Basta con abrir `/dashboard` con una cuenta de coach en un preview de Vercel y confirmar
que carga y que la línea de "última vez" sale poblada.

## 6. Recién ahora, mezclar y compilar

---

## Lo que va en la misma compilación

Tres cosas más que están anotadas y que conviene meter en el mismo build:

1. **`trainer-app/src/navigation/index.tsx:184`** — agregar `'free_month'` a la lista
   blanca. Es de la rama del marketplace: sin eso, el coach dentro de su mes de regalo
   tiene el panel web abierto pero ve "SUSCRIPCIÓN INACTIVA" en el iPhone.
2. **`SubscriptionExpiredScreen`** le dice "SUSCRIPCIÓN INACTIVA" al coach en estado
   `marketplace`, que nunca tuvo una suscripción.
3. **Coaches que no actualicen la app** seguirán viendo el calendario con el filtro viejo
   y no verán las sesiones que ellos mismos anotaron. Es transitorio y cosmético, pero
   explica reportes raros durante la transición.

## Deuda anotada, fuera de esta rama

- **`web/src/app/clients/[id]/calendar/page.tsx:128-133`** pide los registros con
  `.in('series_id', allSeriesIds)` y se traga el error con un `console.error`. Viola dos
  reglas duras del `CLAUDE.md` a la vez, es preexistente, y es literalmente el bug que ya
  rompió esa pantalla una vez. Merece rama propia y prioridad alta.
- **Ninguna de las dos copias de `coachDashboard` tiene tests.** La atribución es ahora un
  algoritmo de veinte líneas duplicado a mano entre `web/` y `trainer-app/`, y el
  `CLAUDE.md` exige que los valores no diverjan. Antes de la próxima rama que toque esos
  archivos, deberían tener el mismo caso de prueba en ambos lados.
- **`plan_week_id`** quedó en el `select` de días sin consumidor. Se limpia en la próxima
  rama que toque el archivo.
- **Las políticas `series_read` / `days_read` de la `v3`** siguen ancladas en `created_by`
  mientras `logs_lectura` de la `v21` ancla en `coach_id`. Si el caso de "plan del alumno
  creado por otro coach" llega a ser real (hoy la comprobación del paso 1 debería dar
  cero), la `v3` habría que alinearla.
