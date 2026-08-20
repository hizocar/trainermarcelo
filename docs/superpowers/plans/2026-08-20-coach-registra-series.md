# El coach registra las series del alumno — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el coach, parado al lado de su alumno, pueda ir anotando las repeticiones y los pesos desde su propio teléfono, y que el alumno los vea como propios.

**Architecture:** No hay pantalla nueva. `WorkoutLogScreen` —la que el alumno ya usa— recibe un `athleteId` explícito y sirve para los dos actores; `ClientWeekScreen` hace tocables los ejercicios de la semana en curso. En la base, `logged_by` deja de significar "de quién es el registro" y pasa a significar "quién lo tecleó": la pertenencia se resuelve por el plan, con políticas nuevas en `v21`.

**Tech Stack:** Expo SDK 54 (`expo ~54.0.36`), React Native 0.81.5, TypeScript, Jest, Supabase (Postgres + RLS).

## Global Constraints

- **Expo SDK 54.** Leer `https://docs.expo.dev/versions/v54.0.0/` antes de escribir código; las APIs de versiones más nuevas no existen acá. **Sin dependencias nuevas.**
- Solo se toca `trainer-app/`, **salvo la Task 7**, donde el dueño autorizó explícitamente ampliar el alcance a `web/src/lib/coachDashboard.ts` porque la base de datos es compartida.
- **`logged_by` significa "quién tecleó".** La pertenencia del registro se deriva del plan.
- **El alumno ve lo que anotó su coach como propio, sin marca de origen.**
- **Solo la semana en curso**, la de `getCurrentWeek()` de `trainer-app/src/lib/weeks.ts`.
- **El coach no escribe la nota de sesión ni el ánimo del día.** Son del alumno; se muestran en solo lectura.
- Existe el índice único `workout_logs (series_id, week_number)`: un registro por serie y semana.
- **Tema monocromo.** El único color es el ámbar `#C9A227` (`colors.warning`), reservado para "esto requiere que el coach haga algo". La confirmación de sobrescritura **no** es ámbar.
- Textos en español de Chile.
- Los tests corren desde `trainer-app/`: `npm test` (Jest). Solo hay tests de lógica pura, en `src/lib/__tests__/`.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `trainer-app/supabase_migration_v21.sql` | Las políticas nuevas de `workout_logs`. Único SQL. |
| `trainer-app/src/lib/overwrite.ts` | Lógica pura: cuándo hay que confirmar y qué dice la confirmación. |
| `trainer-app/src/lib/logPayload.ts` | Los campos que se reescriben al reemplazar un registro. Aparte de `offline.ts` porque ese archivo no se puede importar desde Jest. |
| `trainer-app/src/lib/offline.ts` | Se modifica: el update debe escribir `logged_by`. |
| `trainer-app/src/screens/client/WorkoutLogScreen.tsx` | Se modifica: `athleteId` explícito y el bloqueo de series ya registradas. |
| `trainer-app/src/screens/coach/ClientWeekScreen.tsx` | Se modifica: ejercicios tocables en la semana en curso. |

---

### Task 1: Lógica pura de la sobrescritura

**Files:**
- Create: `trainer-app/src/lib/overwrite.ts`
- Test: `trainer-app/src/lib/__tests__/overwrite.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `type SerieRegistrada = { seriesNumber: number; weight: number; reps: number }`, `necesitaConfirmar(args: { esPropio: boolean; yaRegistrada: boolean; desbloqueada: boolean }): boolean`, `textoConfirmacion(s: SerieRegistrada): string`.

- [ ] **Step 1: Escribir el test que falla**

Crear `trainer-app/src/lib/__tests__/overwrite.test.ts`:

```ts
import { necesitaConfirmar, textoConfirmacion } from '../overwrite';

describe('necesitaConfirmar', () => {
  it('no molesta al alumno con su propio entrenamiento', () => {
    expect(necesitaConfirmar({ esPropio: true, yaRegistrada: true, desbloqueada: false })).toBe(false);
    expect(necesitaConfirmar({ esPropio: true, yaRegistrada: false, desbloqueada: false })).toBe(false);
  });

  it('el coach escribe directo en una serie vacía', () => {
    expect(necesitaConfirmar({ esPropio: false, yaRegistrada: false, desbloqueada: false })).toBe(false);
  });

  it('el coach tiene que confirmar antes de pisar una serie ya registrada', () => {
    expect(necesitaConfirmar({ esPropio: false, yaRegistrada: true, desbloqueada: false })).toBe(true);
  });

  it('una vez confirmada, no vuelve a preguntar en cada tecla', () => {
    expect(necesitaConfirmar({ esPropio: false, yaRegistrada: true, desbloqueada: true })).toBe(false);
  });
});

describe('textoConfirmacion', () => {
  it('nombra la serie y el valor que se va a perder', () => {
    expect(textoConfirmacion({ seriesNumber: 2, weight: 80, reps: 10 }))
      .toBe('La serie 2 ya tiene 80 kg × 10. ¿Reemplazar?');
  });

  it('no arrastra decimales inventados', () => {
    expect(textoConfirmacion({ seriesNumber: 1, weight: 7.5, reps: 12 }))
      .toBe('La serie 1 ya tiene 7,5 kg × 12. ¿Reemplazar?');
  });

  it('el peso corporal se dice sin kilos', () => {
    expect(textoConfirmacion({ seriesNumber: 3, weight: 0, reps: 8 }))
      .toBe('La serie 3 ya tiene 8 repeticiones. ¿Reemplazar?');
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd trainer-app && npx jest src/lib/__tests__/overwrite.test.ts`
Expected: FAIL — `Cannot find module '../overwrite'`.

- [ ] **Step 3: Escribir la implementación**

Crear `trainer-app/src/lib/overwrite.ts`:

```ts
// Cuándo el coach tiene que confirmar antes de pisar lo que el alumno ya
// registró. Vive acá y no en la pantalla porque la pantalla de registro son
// 849 líneas y esta es la única regla nueva que trae la función del coach.
//
// El índice único workout_logs (series_id, week_number) permite un solo
// registro por serie y semana: escribir encima no crea otro, reemplaza.

export type SerieRegistrada = {
  seriesNumber: number;
  weight: number;
  reps: number;
};

/**
 * `esPropio` — el que teclea es el dueño del entrenamiento.
 * `yaRegistrada` — la serie tenía un valor al abrir la pantalla.
 * `desbloqueada` — ya se confirmó el reemplazo de esta serie en esta visita.
 */
export function necesitaConfirmar(args: {
  esPropio: boolean;
  yaRegistrada: boolean;
  desbloqueada: boolean;
}): boolean {
  if (args.esPropio) return false;
  return args.yaRegistrada && !args.desbloqueada;
}

/** Muestra el valor que se va a perder: confirmar a ciegas no es confirmar. */
export function textoConfirmacion(s: SerieRegistrada): string {
  if (s.weight === 0) {
    return `La serie ${s.seriesNumber} ya tiene ${s.reps} repeticiones. ¿Reemplazar?`;
  }
  const peso = String(s.weight).replace('.', ',');
  return `La serie ${s.seriesNumber} ya tiene ${peso} kg × ${s.reps}. ¿Reemplazar?`;
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd trainer-app && npm test`
Expected: PASS, incluidos los once archivos de test que ya existían.

- [ ] **Step 5: Commit**

```bash
git add trainer-app/src/lib/overwrite.ts trainer-app/src/lib/__tests__/overwrite.test.ts
git commit -m "feat(registro): lógica de confirmación antes de sobrescribir una serie"
```

---

### Task 2: `logged_by` al sobrescribir

`upsertLog` en `lib/offline.ts` hace update-o-insert por el índice único. En la rama de
update **no toca `logged_by`**, así que si el coach reemplaza lo que anotó el alumno, el
registro sigue diciendo que lo tecleó el alumno.

**Files:**
- Create: `trainer-app/src/lib/logPayload.ts`
- Modify: `trainer-app/src/lib/offline.ts:94-114`
- Test: `trainer-app/src/lib/__tests__/logPayload.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `type LogEscribible = { weight: number; reps: number; rir: number | null; logged_at: string; logged_by: string }` y `buildLogUpdate(log: LogEscribible): LogEscribible`, exportados desde `trainer-app/src/lib/logPayload.ts`.

**Por qué un archivo aparte y no dentro de `offline.ts`:** está comprobado que
`offline.ts` **no se puede importar desde Jest** — su primera línea importa
`@react-native-async-storage/async-storage`, que falla al cargar fuera de un dispositivo
(`AsyncStorage.native.ts:23`). Un test que importe `offline.ts` no llega ni a ejecutarse.
Por eso la función pura vive sola y `offline.ts` la consume.

- [ ] **Step 1: Escribir el test que falla**

Crear `trainer-app/src/lib/__tests__/logPayload.test.ts`:

```ts
import { buildLogUpdate } from '../logPayload';

describe('buildLogUpdate', () => {
  const base = {
    weight: 80, reps: 10, rir: 2,
    logged_at: '2026-08-20T12:00:00.000Z',
    logged_by: 'coach-1',
  };

  it('incluye logged_by: al reemplazar, el registro pasa a ser de quien tecleó', () => {
    expect(buildLogUpdate(base)).toEqual(base);
  });

  it('conserva el rir nulo en vez de perderlo', () => {
    expect(buildLogUpdate({ ...base, rir: null }).rir).toBeNull();
  });

  it('no arrastra campos de más: series_id y week_number identifican la fila, no se actualizan', () => {
    expect(Object.keys(buildLogUpdate(base)).sort())
      .toEqual(['logged_at', 'logged_by', 'reps', 'rir', 'weight']);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd trainer-app && npx jest src/lib/__tests__/logPayload.test.ts`
Expected: FAIL — `Cannot find module '../logPayload'`.

- [ ] **Step 3: Escribir la implementación**

Crear `trainer-app/src/lib/logPayload.ts`:

```ts
/**
 * Los campos que se reescriben cuando una serie ya tenía registro.
 *
 * `logged_by` va incluido a propósito: desde que el coach puede registrar por
 * su alumno, esa columna significa "quién tecleó esto", y al reemplazar el que
 * tecleó es el nuevo. Sin esto el historial atribuye el número a quien ya no fue.
 * `series_id` y `week_number` identifican la fila y por eso no se actualizan.
 */
export type LogEscribible = {
  weight: number;
  reps: number;
  rir: number | null;
  logged_at: string;
  logged_by: string;
};

export function buildLogUpdate(log: LogEscribible): LogEscribible {
  return {
    weight: log.weight,
    reps: log.reps,
    rir: log.rir,
    logged_at: log.logged_at,
    logged_by: log.logged_by,
  };
}
```

Y en `trainer-app/src/lib/offline.ts`, importar la función
(`import { buildLogUpdate } from './logPayload';`) y reemplazar el objeto literal del
update por la llamada:

```ts
  return existing
    ? await supabase.from('workout_logs').update(buildLogUpdate(log)).eq('id', existing.id)
    : await supabase.from('workout_logs').insert({
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd trainer-app && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add trainer-app/src/lib/logPayload.ts trainer-app/src/lib/offline.ts trainer-app/src/lib/__tests__/logPayload.test.ts
git commit -m "fix(registro): al reemplazar una serie, logged_by pasa a ser quien tecleó"
```

---

### Task 3: Migración `v21` — las políticas de `workout_logs`

Esta migración reemplaza las políticas de la tabla donde vive el entrenamiento de todos
los alumnos que ya usan el producto. Una política mal escrita no falla con un error
visible: deja la app **mostrando menos datos de los que hay**.

**Files:**
- Create: `trainer-app/supabase_migration_v21.sql`

**Interfaces:**
- Consumes: `public.workout_logs`, `public.exercise_series`, `public.exercises`, `public.training_days`, `public.workout_plans`, `public.users`.
- Produces: la función `public.serie_de_mi_plan(p_series_id uuid) returns boolean` y las políticas `logs_lectura`, `logs_insert`, `logs_update`.

- [ ] **Step 1: Leer las políticas que se reemplazan**

Leer `trainer-app/supabase_schema.sql` líneas 124-132 (`logs_client`, `logs_coach`) y
`trainer-app/supabase_migration_v6.sql` líneas 76-88 (`logs_client_insert`). Copiar el
estilo de comentarios de `supabase_migration_v18.sql`, la más reciente de esta rama.

**Sobre el número:** se salta de `v18` a `v21` a propósito. `v19` y `v20` existen en la
rama `marketplace-web`, que todavía no se mezcla y cuyas migraciones tampoco están
aplicadas; usar `v21` evita que dos ramas reclamen el mismo número. El hueco es
cosmético: las migraciones de este proyecto se aplican a mano y son independientes.

- [ ] **Step 2: Escribir la migración**

Crear `trainer-app/supabase_migration_v21.sql`:

```sql
-- v21 — El coach puede registrar las series de su alumno.
--
-- Cambio de fondo: la pertenencia de un workout_log deja de derivarse de
-- logged_by y pasa a derivarse del plan al que pertenece la serie. logged_by
-- queda como lo que siempre debió ser: quién tecleó el registro.
--
-- Sin este cambio, un registro hecho por el coach es INVISIBLE para el alumno:
-- la política vieja era logs_client USING (logged_by = auth.uid()), así que su
-- Hoy, su historial y su progreso lo ignorarían y él creería que no entrenó.

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

-- En Postgres el EXECUTE de una función nueva se otorga a PUBLIC por defecto,
-- y un grant a authenticated SUMA en vez de reemplazar: sin este revoke, la
-- función queda invocable por cualquiera con la anon key.
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
  for update using      (public.serie_de_mi_plan(series_id))
          with check (public.serie_de_mi_plan(series_id));

-- Sin política de delete a propósito: ningún archivo de la app borra
-- workout_logs directamente. Los registros desaparecen solo por el
-- on delete cascade desde exercise_series, que no consulta estas políticas.
-- La política vieja logs_client era FOR ALL y daba borrado al alumno; era un
-- permiso que nadie usaba y no se replica.
```

- [ ] **Step 3: Verificar la sintaxis leyendo, no ejecutando**

Comprobar: los `$$` abren y cierran; cada sentencia termina en `;`; las columnas
referenciadas existen (`workout_plans.client_id`, `users.coach_id`, `exercise_series.exercise_id`,
`exercises.day_id`, `training_days.plan_id`) — confirmarlas contra `trainer-app/supabase_schema.sql`;
y ningún `grant` menciona un objeto que no se creó.

**No la apliques.** No hay acceso a Supabase en esta sesión. Deja en tu informe el
archivo listado como pendiente para el dueño, junto con las comprobaciones del Step 4.

- [ ] **Step 4: Escribir las comprobaciones que tendrá que correr el dueño**

Dejar en el informe, listas para pegar, estas dos verificaciones con **sesiones
distintas** — son las únicas que validan la migración de verdad:

1. Con la sesión del **alumno**: después de que su coach registre una serie, el alumno
   ve ese registro en su Hoy y en su historial.
2. Con la sesión de **un coach que no es su coach**: no ve ni puede escribir ningún
   registro de ese plan.

Y esta consulta, para confirmar que las políticas quedaron como se espera:

```sql
select polname, polcmd, pg_get_expr(polqual, polrelid) as using_expr
from pg_policy where polrelid = 'public.workout_logs'::regclass
order by polname;
```

Esperado: exactamente tres filas —`logs_insert` (a), `logs_lectura` (r), `logs_update` (w)—
y ninguna que mencione `logged_by` en su `using`.

- [ ] **Step 5: Commit**

```bash
git add trainer-app/supabase_migration_v21.sql
git commit -m "feat(registro): políticas de workout_logs por plan en vez de por logged_by"
```

---

### Task 4: `WorkoutLogScreen` recibe `athleteId`

Refactor de identidad, **sin ningún cambio visible para el alumno**. El archivo son 849
líneas y usa `useAuth().user.id` con dos significados mezclados.

**Files:**
- Modify: `trainer-app/src/screens/client/WorkoutLogScreen.tsx:45-46, 160, 170, 276, 328`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces: `WorkoutLogScreen` acepta `route.params.athleteId?: string`. Cuando falta, vale `user.id` (el alumno entrando a lo suyo). Las tareas 5 y 6 lo usan.

- [ ] **Step 1: Leer el archivo entero antes de tocarlo**

Buscar **todas** las apariciones de `user.id` y `user!.id`: hoy son cinco, en dos roles
distintos. `session_notes.user_id` (líneas 160 y 170) y las consultas del plan significan
*de quién es el entrenamiento*; `logged_by` (líneas 276 y 328) significa *quién teclea*.

- [ ] **Step 2: Agregar el parámetro y derivar la identidad**

En la interfaz `RouteParams` del archivo, agregar `athleteId?: string`. Después de
`const { user } = useAuth();`:

```tsx
  // De quién es este entrenamiento. Cuando entra el alumno es él mismo; cuando
  // entra el coach a registrar por su alumno, llega por parámetro. Antes esto y
  // `user.id` eran lo mismo y por eso el archivo los usaba indistintamente.
  const athleteId = (route.params as RouteParams).athleteId ?? user!.id;
  const esPropio = athleteId === user!.id;
```

- [ ] **Step 3: Repartir los dos significados**

- Línea ~160 (`.eq('user_id', user.id)` al leer `session_notes`) → `athleteId`.
- Línea ~170 (`{ user_id: user.id, ... }` al escribir `session_notes`) → `athleteId`.
- Líneas ~276 y ~328 (`logged_by: user!.id`) → **se quedan como están**: es quien teclea.

Revisar además cualquier otra consulta del archivo que filtre por el usuario para traer
el plan o los logs: si significa "de quién es el entrenamiento", va `athleteId`.

- [ ] **Step 4: Verificar que para el alumno no cambió nada**

Run: `cd trainer-app && npx tsc --noEmit && npm test`
Expected: sin errores de tipos; los tests siguen pasando.

Comprobar leyendo que **ningún** `athleteId` quedó donde iba `logged_by` ni al revés:
`grep -n "athleteId\|logged_by\|user!\?\.id" src/screens/client/WorkoutLogScreen.tsx`.
Cuando `athleteId` es `user.id` —el caso del alumno, el único que existe hasta la Task 5—
las dos variables valen lo mismo, así que un error acá **no se manifiesta todavía**: se
manifiesta recién cuando entra el coach. Por eso se revisa leyendo.

- [ ] **Step 5: Commit**

```bash
git add trainer-app/src/screens/client/WorkoutLogScreen.tsx
git commit -m "refactor(registro): separar de quién es el entrenamiento de quién lo teclea"
```

---

### Task 5: Los ejercicios de la semana en curso se tocan

**Files:**
- Modify: `trainer-app/src/screens/coach/ClientWeekScreen.tsx`

**Interfaces:**
- Consumes: `WorkoutLogScreen` con `route.params.athleteId` (Task 4); `getCurrentWeek()` de `src/lib/weeks.ts`, que el archivo ya importa; la ruta `'WorkoutLog'`.
- Produces: nada.

- [ ] **Step 1: Comprobar que la ruta existe para el coach**

`WorkoutLog` está registrada en `trainer-app/src/navigation/index.tsx:223`, **dentro del
grupo del alumno**. Verificarlo y, si el coach no la alcanza, registrarla también en el
grupo del coach (junto a `ClientWeek`, línea ~209). Dilo en tu informe: es la diferencia
entre que la función ande o dé un error de navegación.

- [ ] **Step 2: Hacer tocable la fila del ejercicio**

En el render de los ejercicios de cada día, envolver la fila en un `TouchableOpacity`
cuando `week === currentWeek`, y dejarla como está en cualquier otra semana:

```tsx
const registrable = week === currentWeek;

// … dentro del map de ejercicios:
registrable ? (
  <TouchableOpacity
    activeOpacity={0.8}
    onPress={() => navigation.navigate('WorkoutLog', {
      exercise: ex,
      week,
      athleteId: client.id,
    })}
  >
    {filaEjercicio}
  </TouchableOpacity>
) : filaEjercicio
```

`filaEjercicio` es el JSX que ese map ya devuelve hoy: extraerlo a una constante dentro
del map, sin cambiarlo, para no duplicarlo entre las dos ramas.

**Verificar qué espera `WorkoutLogScreen` en `route.params.exercise`** y pasarle
exactamente esa forma. `ClientWeekScreen` arma sus ejercicios con `fetchFullPlan`, que
puede no traer los mismos campos que el alumno le pasa desde su pantalla de Hoy. Si
falta alguno, decirlo en el informe en vez de improvisar un objeto parcial: un campo
faltante acá se manifiesta como una pantalla de registro vacía, no como un error.

- [ ] **Step 3: Que se note que se puede tocar**

En la cabecera, cuando `registrable` es verdadero, una línea con el estilo `label` que ya
usa el archivo:

```tsx
{registrable && (
  <Text style={styles.hint}>TOCA UN EJERCICIO PARA REGISTRAR SUS SERIES</Text>
)}
```

con `hint: { ...typography.label, color: colors.textMuted, marginBottom: spacing.sm }`.
Gris, no ámbar: el ámbar está reservado para lo que exige acción del coach, y esto es una
posibilidad, no una tarea pendiente.

- [ ] **Step 4: Verificar**

Run: `cd trainer-app && npx tsc --noEmit && npm test`
Expected: sin errores, tests pasando.

- [ ] **Step 5: Commit**

```bash
git add trainer-app/src/screens/coach/ClientWeekScreen.tsx trainer-app/src/navigation/index.tsx
git commit -m "feat(registro): tocar un ejercicio de la semana en curso abre su registro"
```

---

### Task 6: El bloqueo de las series ya registradas

Hay un detalle que hace esto necesario y no cosmético: `WorkoutLogScreen` tiene
**guardado automático con 900 ms de espera** (`flushAutoSave`, líneas 259-281) y además
fuerza un guardado al salir de la pantalla. Si el coach teclea encima de un valor
existente, se guarda solo. Por eso la confirmación tiene que bloquear la **edición**, no
el guardado.

**Files:**
- Modify: `trainer-app/src/screens/client/WorkoutLogScreen.tsx`

**Interfaces:**
- Consumes: `necesitaConfirmar`, `textoConfirmacion`, `SerieRegistrada` de `src/lib/overwrite.ts` (Task 1); `athleteId` y `esPropio` (Task 4).
- Produces: nada.

- [ ] **Step 1: Guardar el valor original de cada serie**

En `SeriesEntry` (línea ~34) agregar dos campos:

```ts
  /** Tenía registro al abrir la pantalla: el coach no lo pisa sin confirmar. */
  yaRegistrada: boolean;
  /** El coach ya confirmó reemplazar esta serie en esta visita. */
  desbloqueada: boolean;
```

Al armar las entradas (línea ~228, donde hoy dice `saved: !!cur`), agregar
`yaRegistrada: !!cur` y `desbloqueada: false`. **`saved` no cambia de significado**: sigue
siendo "lo que hay en pantalla ya está guardado".

- [ ] **Step 2: Bloquear la edición en `updateEntry`**

Reemplazar el cuerpo de `updateEntry` (línea ~234) por:

```tsx
  function updateEntry(index: number, field: 'weight' | 'reps' | 'rir', value: string) {
    const e = entries[index];
    if (necesitaConfirmar({ esPropio, yaRegistrada: e.yaRegistrada, desbloqueada: e.desbloqueada })) {
      const cur = currentLogRef.current[e.series.id];
      showConfirm(
        textoConfirmacion({
          seriesNumber: e.series.series_number,
          weight: cur?.weight ?? 0,
          reps: cur?.reps ?? 0,
        }),
        () => setEntries(prev => prev.map((x, i) => i === index ? { ...x, desbloqueada: true } : x)),
      );
      return;
    }

    // permitir solo dígitos y un separador decimal (punto o coma)
    const clean = value.replace(/[^0-9.,]/g, '').replace(/([.,].*)[.,]/, '$1');
    setEntries(prev => prev.map((x, i) => i === index
      ? { ...x, [field]: clean, saved: false }
      : x
    ));
  }
```

`currentLogRef` es una `useRef` con el mapa `series_id → { weight, reps }` que la carga ya
construye en `currentMap` (línea ~199): guardarlo en la ref al terminar de cargar. Se
usa el valor **original**, no el de pantalla, porque es el que se va a perder.

Para `showConfirm`, **usar el mismo helper de alertas que el archivo ya usa** — buscar
`showAlert` en el archivo y en `src/lib/`; si el que existe no acepta dos botones,
extenderlo o usar `Alert.alert` de React Native con dos botones, el de confirmar en
`style: 'destructive'`. No agregar una librería de diálogos.

- [ ] **Step 3: La nota de sesión y el ánimo, en solo lectura para el coach**

Buscar en el archivo los controles de la nota de sesión y del ánimo. Cuando `esPropio` es
falso: mostrar el contenido si existe, sin campo editable ni botón de guardar. Si no hay
nada escrito, no mostrar la sección. Esos datos son del alumno.

- [ ] **Step 4: Verificar**

Run: `cd trainer-app && npx tsc --noEmit && npm test`
Expected: sin errores, tests pasando.

Comprobar leyendo que para el alumno (`esPropio === true`) `necesitaConfirmar` devuelve
siempre `false` y por lo tanto `updateEntry` se comporta **exactamente** como antes:
ninguna serie se bloquea, el guardado automático sigue igual.

- [ ] **Step 5: Commit**

```bash
git add trainer-app/src/screens/client/WorkoutLogScreen.tsx
git commit -m "feat(registro): el coach confirma antes de reemplazar una serie del alumno"
```

---

---

### Task 7: Las cuatro consultas que filtran por `logged_by`

**Agregada el 2026-08-20**, después de que la revisión de la Task 3 encontrara que el
cambio de significado de `logged_by` rompe consultas que ninguna otra tarea toca. **El
dueño autorizó ampliar el alcance a `web/`** para esta tarea, porque la base es
compartida: la migración cambia el comportamiento de la web aunque la web no se toque.

**Files:**
- Modify: `web/src/lib/coachDashboard.ts:5-11, 84-88, 114-118`
- Modify: `trainer-app/src/lib/coachDashboard.ts:80-84` y su bloque de atribución equivalente
- Modify: `trainer-app/src/screens/coach/ClientCalendarScreen.tsx:163-173`
- Modify: `trainer-app/src/screens/client/SessionDetailScreen.tsx:47-55`

**Interfaces:**
- Consumes: la migración `v21` (Task 3), que hace que RLS acote los registros a los planes del coach.
- Produces: nada.

**La regla dura que gobierna esta tarea**, del `CLAUDE.md` del repo: *número fijo de
consultas, ningún `.in(...)` acotado por el número de series de un plan, y nunca
descartar el `error`*. La cabecera de `web/src/lib/coachDashboard.ts:5-11` documenta que
pedir los registros por `series_id` es exactamente el error que hizo fallar en silencio
al calendario y dibujar el mes como "nadie entrenó". **La solución no es cambiar
`logged_by` por una lista de series.**

- [ ] **Step 1: El panel del coach — quitar el filtro, no cambiarlo**

En `web/src/lib/coachDashboard.ts:84-88`, la consulta hoy es:

```ts
    .select('series_id, logged_by, logged_at, week_number')
    .in('logged_by', clientIds)
    .in('week_number', [currentWeek - 1, currentWeek]);
```

El filtro por `logged_by` **se elimina**, no se reemplaza:

```ts
    .select('series_id, logged_at, week_number')
    .in('week_number', [currentWeek - 1, currentWeek]);
```

Con las políticas de `v21`, RLS ya acota los registros a los planes de los alumnos de
quien consulta: el filtro era redundante y ahora además es incorrecto. Se quita una
condición en vez de agregar una lista larga, así que la regla dura se respeta sola y el
número de consultas no cambia.

- [ ] **Step 2: Atribuir el registro por el plan, no por quién tecleó**

`web/src/lib/coachDashboard.ts:114-118` usa `l.logged_by` como el id del alumno:

```ts
      const prev = lastTrainedByClient.get(l.logged_by);
      if (!prev || key > prev) lastTrainedByClient.set(l.logged_by, key);
```

El archivo ya tiene todo lo necesario para derivarlo: `planByClient` (línea 54) y
`dayBySeries`, que guarda `planId` por serie. Construir el mapa inverso junto a
`planByClient`:

```ts
  const clientByPlan = new Map<string, string>();
  (plans ?? []).forEach((p: any) => clientByPlan.set(p.id, p.client_id));
```

y reemplazar la atribución por:

```ts
      const clienteId = clientByPlan.get(dayBySeries.get(l.series_id)?.planId ?? '');
      if (!clienteId) return;
      const prev = lastTrainedByClient.get(clienteId);
      if (!prev || key > prev) lastTrainedByClient.set(clienteId, key);
```

**Comprueba antes de darlo por bueno:** `dayBySeries` se construye solo con los días **no
archivados** y que no se llamen "libre" (el `.filter(...)` unas líneas más arriba). Con
`logged_by` la fecha del último entrenamiento no dependía de eso. Verifica si un registro
sobre un día archivado deja de contar para "última vez que entrenó" y, si es así, dilo en
tu informe: es un cambio de comportamiento real, no un detalle.

Actualiza también el comentario de la cabecera (líneas 5-11), que explica que se pide por
`logged_by`. Un comentario que describe lo que el código ya no hace es cómo se llega al
error que esta tarea arregla.

- [ ] **Step 3: El mismo cambio en la app**

`trainer-app/src/lib/coachDashboard.ts` es la copia de la anterior para la app —
duplicación asumida en este proyecto, porque son proyectos npm separados. Aplica el mismo
cambio de los pasos 1 y 2. **Lo que no puede pasar es que los valores diverjan.**

- [ ] **Step 4: El calendario del coach**

`trainer-app/src/screens/coach/ClientCalendarScreen.tsx:170` filtra
`.eq('logged_by', client.id)`, así que dibujará vacías las sesiones que registró el
coach. Quitar esa línea.

El archivo ya construye `exBySeries` y descarta las series que no conoce
(`const exId = exBySeries.get(l.series_id); if (!exId) return;` o equivalente —
verifícalo), así que los registros de **otros** alumnos que ahora entran por RLS se
descartan solos. **Confirma que ese descarte existe antes de quitar el filtro**; si no
existe, agrégalo y dilo en tu informe, porque sin él el calendario de un alumno mostraría
entrenamientos de otro.

Deja anotado en tu informe cuántos registros de más viaja esta consulta ahora (dos
semanas de todos los alumnos del coach en vez de uno solo). Si te parece demasiado, dilo
— no lo optimices por tu cuenta con un `.in('series_id', ...)`, que es el patrón
prohibido.

- [ ] **Step 5: Corregir la fecha de una sesión**

`trainer-app/src/screens/client/SessionDetailScreen.tsx:47-55` actualiza filtrando
`.eq('logged_by', user!.id)`: el alumno no podría corregir la fecha de una sesión que
anotó su coach, y la pantalla **igual diría "Fecha corregida"** porque un update de cero
filas no devuelve error.

Quitar `.eq('logged_by', user!.id)`. El `.in('series_id', ...)` que ya está acotado a las
series de **esa sesión** se queda: es una lista corta y no es el patrón prohibido, que se
refiere a listas que crecen con el plan entero. RLS impide tocar registros de otro plan.

Además, hacer que la pantalla no mienta cuando no cambió nada: pedir el conteo de filas
afectadas y, si es cero, mostrar un aviso de que no se pudo corregir en vez de decir que
sí. En `@supabase/supabase-js` eso se consigue agregando `{ count: 'exact' }` a la
llamada `.update(...)` y mirando el `count` de la respuesta; verifica la forma exacta
contra la versión que usa el proyecto (`trainer-app/package.json`) antes de escribirlo.

- [ ] **Step 6: Verificar**

Run: `cd trainer-app && npx tsc --noEmit && npm test`
Run: `cd web && npx tsc --noEmit && npm test`
Expected: sin errores en ninguno de los dos, todos los tests pasando.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/coachDashboard.ts trainer-app/src/lib/coachDashboard.ts trainer-app/src/screens/coach/ClientCalendarScreen.tsx trainer-app/src/screens/client/SessionDetailScreen.tsx
git commit -m "fix(registro): atribuir los registros por el plan y no por quién los tecleó"
```

## Verificación final, antes de compilar

- [ ] `cd trainer-app && npm test` — todos los tests pasan, incluidos los once archivos previos.
- [ ] `cd trainer-app && npx tsc --noEmit` — sin errores.
- [ ] **Pendiente para el dueño, en la base:** aplicar `supabase_migration_v21.sql` y correr las dos comprobaciones con sesiones distintas (alumno y coach ajeno) de la Task 3. Hasta que la migración esté aplicada, el coach **puede** escribir —la política de v6 ya se lo permitía— pero **el alumno no verá** esos registros. Aplicar la migración antes de que ningún coach use la función.
- [ ] Esta función necesita una compilación nueva. Va junto con las dos deudas ya anotadas: agregar `'free_month'` a la lista blanca de `src/navigation/index.tsx:184`, y el texto "SUSCRIPCIÓN INACTIVA" que se le muestra a un coach que nunca tuvo suscripción.
