# El coach registra las series del alumno mientras entrena

**Fecha:** 2026-08-20
**Estado:** diseño aprobado, sin construir
**Origen:** observación de Marcelo — el alumno está concentrado en el ejercicio y el
coach, que está al lado, puede ir anotando por él.
**Alcance:** solo `trainer-app/` y una migración `trainer-app/supabase_migration_v21.sql`.

## El problema

Hoy solo el alumno registra sus series. Cuando entrena acompañado, tiene el teléfono en
el bolsillo y las manos en la barra: o interrumpe la serie para anotar, o anota después
de memoria. El coach está al lado sin nada que hacer con las manos.

El alumno que entrena solo se autogestiona igual que hoy. Esto **agrega** un segundo
camino de entrada, no reemplaza el que existe.

## La decisión de fondo: qué significa `logged_by`

`public.workout_logs` no tiene `client_id`. La pertenencia del registro se expresa
**únicamente** con `logged_by`, y la política de lectura del alumno es
`logs_client: FOR ALL USING (logged_by = auth.uid())`.

Eso significa que hoy `logged_by` carga dos significados a la vez —*de quién es este
entrenamiento* y *quién lo tecleó*— que coinciden siempre y por eso nunca se notaron.
Esta función los separa por primera vez.

**A partir de acá, `logged_by` significa solo "quién lo tecleó".** La pertenencia se
resuelve por el plan al que pertenece la serie. Sin este cambio, un registro hecho por el
coach queda **invisible para el alumno**: su Hoy, su historial y su progreso lo ignoran,
y él creería que no entrenó.

El alumno ve lo que anotó su coach **como propio, sin distinción**. No hay marca de
origen en el historial: es su entrenamiento, lo haya tecleado quien lo haya tecleado.

## Migración `v21`

Reemplaza las políticas de `workout_logs`. El predicado de pertenencia ya existe en la
política de inserción que creó `v6`; lo que hace `v21` es extenderlo a leer y actualizar.

```sql
-- v21 — El coach puede registrar las series de su alumno.
--
-- Cambio de fondo: la pertenencia de un workout_log deja de derivarse de logged_by
-- y pasa a derivarse del plan al que pertenece la serie. logged_by queda como lo que
-- siempre debió ser: quién tecleó el registro.

create or replace function public.serie_de_mi_plan(p_series_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.exercise_series es
    join public.exercises e       on e.id  = es.exercise_id
    join public.training_days td  on td.id = e.day_id
    join public.workout_plans wp  on wp.id = td.plan_id
    join public.users cli         on cli.id = wp.client_id
    where es.id = p_series_id
      and (cli.id = auth.uid() or cli.coach_id = auth.uid())
  );
$$;

revoke execute on function public.serie_de_mi_plan(uuid) from public, anon;
grant  execute on function public.serie_de_mi_plan(uuid) to authenticated;

drop policy if exists "logs_client"        on public.workout_logs;
drop policy if exists "logs_coach"         on public.workout_logs;
drop policy if exists "logs_client_insert" on public.workout_logs;

create policy "logs_lectura" on public.workout_logs
  for select using (public.serie_de_mi_plan(series_id));

create policy "logs_insert" on public.workout_logs
  for insert with check (
    logged_by = auth.uid() and public.serie_de_mi_plan(series_id)
  );

create policy "logs_update" on public.workout_logs
  for update using (public.serie_de_mi_plan(series_id))
          with check (public.serie_de_mi_plan(series_id));
```

**No hay política de `delete` a propósito.** Se buscó en toda la app: ningún archivo borra
`workout_logs` directamente. Los registros desaparecen solo por el `on delete cascade`
desde `exercise_series`, que no consulta políticas de esta tabla. La política anterior
`logs_client` era `FOR ALL` y daba borrado al alumno, pero era un permiso que nadie
usaba; no se replica.

Dos diferencias respecto de lo que había, deliberadas:

- La pertenencia se ancla en **`workout_plans.client_id` y el `coach_id` del alumno**, no
  en `workout_plans.created_by`. Un plan creado por otro coach del mismo gimnasio, o
  duplicado desde una plantilla, sigue siendo del alumno; atarlo a quién lo creó dejaría
  fuera casos reales que hoy funcionan.
- Se separan las cuatro operaciones en vez de un `FOR ALL`. `FOR ALL` con un solo
  `USING` deja el `WITH CHECK` implícito, y en una tabla donde ahora escriben dos actores
  distintos conviene que la condición de escritura esté escrita.

**`serie_de_mi_plan` es `security definer` y se le revoca `EXECUTE` a `public` y `anon`**:
en Postgres el `EXECUTE` de una función nueva se otorga a `PUBLIC` por defecto y un
`grant ... to authenticated` suma en vez de reemplazar, así que sin el `revoke` quedaría
invocable por cualquiera con la anon key.

## Cambios en la app

### `WorkoutLogScreen` recibe una identidad explícita

Son 849 líneas y usa `useAuth().user.id` en cuatro lugares con los dos significados
mezclados. Se separan:

- **`athleteId`** — de quién es el entrenamiento. Alimenta `session_notes.user_id` y las
  consultas del plan. Llega por `route.params`.
- **`user!.id`** — quién teclea. Alimenta `logged_by`.

Cuando entra el alumno, la pantalla recibe `athleteId = user.id` y **nada cambia para
él**: mismo comportamiento, mismos datos, misma cola offline.

### `lib/offline.ts`

`upsertLog` (línea 94) hace update-o-insert porque existe el índice único
`workout_logs (series_id, week_number)` que creó `v6`. Hoy, en la rama de update, **no
toca `logged_by`**. Hay que agregarlo: si el coach reemplaza lo que anotó el alumno, el
registro debe decir que lo tecleó el coach.

La cola offline es parte del alcance y no un detalle: un gimnasio es exactamente donde no
hay señal, y el coach va a estar registrando ahí.

### Recorrido nuevo

Desde `ClientDetailScreen`, un acceso junto a los que ya existen (`Semana`, `Calendario`,
`Progreso`, `Composición`): **"Registrar entrenamiento"**. Lleva a la lista de días de la
semana en curso, con el mismo anillo de series completadas que ve el alumno, y de ahí a
`WorkoutLogScreen` con `athleteId` del cliente.

**Solo la semana en curso**, la que devuelve `getCurrentWeek()` de `trainer-app/src/lib/weeks.ts`
— la misma que ya usan `ClientDetailScreen` y `ClientWeekScreen`, y la misma que usa el
alumno, para que coach y alumno nunca estén mirando semanas distintas. (`getCurrentWeek()`
es el correcto acá: la regla de `santiagoCurrentWeek()` es de `web/`, donde el servidor
corre en UTC; la app corre en el teléfono del usuario.) Registrar días pasados es corregir
historial: otra función, con otras preguntas (¿hasta cuándo atrás? ¿el alumno se entera?).
Acá no entra.

### El choque se evita, no se resuelve

El índice único permite un registro por serie y semana. La pantalla del coach muestra las
series ya registradas llenas y atenuadas, así que lo normal es que solo rellene lo vacío.
Tocar una serie llena abre una confirmación con el valor actual —"la serie 2 ya tiene
80 kg × 10, ¿reemplazar?"— antes de permitir escribir. La confirmación aparece **solo**
cuando ya hay un valor; una serie vacía se registra de una.

## Lo que el coach no puede hacer

- **La nota de sesión y el ánimo del día son del alumno.** El coach no los escribe. La
  pantalla los muestra si existen, en solo lectura.
- **No registra cardio** (`cardio_logs`, de `v18`). Si hace falta, es su propia función.
- **No corrige semanas pasadas.**

## Pruebas

La lógica que se puede probar sin base es la del choque y la de la identidad:

- `athleteId` distinto de `operatorId` produce un log con `logged_by = operatorId`;
  iguales, el comportamiento de hoy.
- La rama de update de `upsertLog` escribe el `logged_by` nuevo.
- La confirmación se pide **solo** si la serie ya tiene valor.

Los invariantes que de verdad protegen viven en las políticas de `v21` y ningún test de
Jest los cubre. El plan incluye un paso explícito de verificación contra Supabase:
con la sesión del **alumno**, comprobar que ve un log insertado por su coach; con la
sesión de **un coach distinto**, comprobar que no ve ni puede escribir nada de ese plan.

## Riesgo, dicho claro

`v21` reemplaza las políticas de la tabla donde vive el entrenamiento de todos los
alumnos en producción. Una política mal escrita no rompe la app con un error visible:
la deja **mostrando menos datos de los que hay**, que es la forma de falla que este
proyecto ya sufrió. La verificación con dos sesiones distintas no es opcional.
