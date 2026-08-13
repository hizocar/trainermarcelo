# Rediseño de la experiencia del coach — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el coach vea de un vistazo quién de sus alumnos necesita atención, y que las pantallas de seguimiento dejen de competir entre sí — con los mismos nombres en la app y en la web.

**Architecture:** Una función pura `clientStatus` (duplicada a propósito en cada proyecto, con tests que verifican que dan lo mismo) decide si un alumno necesita atención a partir de sus días planificados y sus registros de la semana. Las listas de alumnos la usan para partirse en dos grupos. Las fichas de cliente agrupan sus accesos por intención (CÓMO VA / QUÉ VA A HACER / HABLAR) y renombran las entradas para que app y web coincidan. Todas las consultas se acotan por número de alumnos, nunca por número de series.

**Tech Stack:** React Native/Expo (SDK 54) + Jest en `trainer-app/`; Next.js 15 App Router + Vitest en `web/`; Supabase (Postgres + RLS).

## Global Constraints

- **Sin migraciones de base de datos.** Todo sale de tablas existentes: `users`, `workout_plans`, `plan_weeks`, `training_days`, `exercises`, `exercise_series`, `workout_logs`, `messages`.
- **No se elimina ninguna función.** El editor de planes sigue igual de protagonista en la app. Solo cambia cómo se llega a las cosas y cómo se llaman.
- **No se toca `trainer-app/src/screens/coach/PlanEditorScreen.tsx`** (1.116 líneas, el archivo más frágil del proyecto). Nada de este plan lo necesita.
- **Rama:** trabajar en `feat/rediseno-coach`. **NUNCA commitear ni pushear a `sandbox`** — despliega automáticamente a producción (elitefitapp.com), donde hay seis coaches beta usando el producto ahora mismo. El merge lo hace el coordinador al final, una sola vez.
- **Monocromo, con una sola excepción.** El tema es monocromo por decisión documentada (ver el comentario al inicio de `trainer-app/src/theme/index.ts`). El **único** color que se agrega es el ámbar `#c9a227`, reservado exclusivamente para "esto requiere que hagas algo". **No cambiar `danger`, `success`, `info` ni ningún otro token** — que `danger` sea gris es intencional.
- **Paridad app ↔ web (verificable):** `clientStatus` debe devolver exactamente los mismos valores para las mismas entradas en ambos proyectos. La duplicación del archivo es una decisión tomada (proyectos npm separados, sin paquete compartido); **la duplicación no es un hallazgo de revisión, que los valores diverjan sí lo es**. Los tests de ambos proyectos usan los mismos casos.
- **Consultas acotadas.** Las listas de alumnos deben usar un número fijo de consultas, independiente de la cantidad de alumnos, y **ningún `.in(...)` puede recibir una lista que crezca con el número de series del plan**. La revisión del calendario encontró exactamente ese error: una lista de series que crecía sin límite hasta que la consulta fallaba y el mes entero se dibujaba como "nadie entrenó". **Nunca descartar el `error` de una consulta**: un fallo debe verse, no disfrazarse de "nadie entrenó".
- **Autorización.** Toda página web nueva o modificada conserva la cadena existente: `getUser()` → `redirect('/login')` si no hay sesión → `users.role === 'coach'` → `client.coach_id === user.id` con `notFound()` si no.
- **Idioma:** UI y comentarios en español de Chile. Etiquetas de sección en mayúsculas, siguiendo el estilo actual.
- **Commits:** uno por tarea, en español (`feat:` / `fix:` / `test:`).

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `web/src/lib/clientStatus.ts` | **crear** — lógica pura: ¿este alumno necesita atención? |
| `web/src/lib/__tests__/clientStatus.test.ts` | **crear** — tests de esa lógica |
| `web/src/lib/weeks.ts` | **modificar** — agregar `santiagoWeekDay()` |
| `trainer-app/src/lib/clientStatus.ts` | **crear** — espejo exacto de la lógica anterior |
| `trainer-app/src/lib/__tests__/clientStatus.test.ts` | **crear** — mismos casos, mismos resultados |
| `trainer-app/src/theme/index.ts` | **modificar** — `warning` pasa de gris a ámbar |
| `web/src/app/globals.css` | **modificar** — agregar `--warning` |
| `web/src/lib/coachDashboard.ts` | **crear** — carga en bloque de los datos de la lista |
| `web/src/app/dashboard/page.tsx` | **modificar** — lista agrupada con estado |
| `web/src/app/clients/[id]/page.tsx` | **modificar** — accesos agrupados y renombrados |
| `web/src/app/clients/[id]/week/page.tsx` | **modificar** — renombres en el header |
| `web/src/app/clients/[id]/progress/page.tsx` | **modificar** — renombres en el header |
| `web/src/app/clients/[id]/calendar/page.tsx` | **modificar** — renombres en el header |
| `web/src/app/clients/[id]/exercise/[exerciseId]/page.tsx` | **modificar** — renombres en el header |
| `trainer-app/src/lib/coachDashboard.ts` | **crear** — misma carga en bloque para la app |
| `trainer-app/src/screens/coach/ClientListScreen.tsx` | **modificar** — lista agrupada, iconos con texto |
| `trainer-app/src/screens/coach/ClientDetailScreen.tsx` | **modificar** — accesos agrupados y renombrados |
| `trainer-app/src/screens/coach/ClientCalendarScreen.tsx` | **crear** — calendario mensual en la app |
| `trainer-app/src/navigation/index.tsx` | **modificar** — registrar la pantalla nueva |

La lógica pura vive separada de las pantallas a propósito: es lo único con reglas no triviales y lo único testeable sin levantar Supabase.

---

### Task 1: `clientStatus` en la web

**Files:**
- Create: `web/src/lib/clientStatus.ts`
- Modify: `web/src/lib/weeks.ts`
- Test: `web/src/lib/__tests__/clientStatus.test.ts`

**Interfaces:**
- Consumes: `santiagoDayKey(instant: Date): string` (ya existe en `web/src/lib/weeks.ts`, devuelve `"YYYY-MM-DD"` en zona `America/Santiago`)
- Produces:
  - `clientStatus(input: ClientStatusInput): ClientStatus`
  - tipos `ClientStatusInput`, `ClientStatus`
  - `santiagoWeekDay(instant?: Date): number` — día de la semana (0=Dom … 6=Sáb) en Chile

- [ ] **Step 1: Escribir los tests que fallan**

Crear `web/src/lib/__tests__/clientStatus.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { clientStatus } from '../clientStatus';

// week_day usa la convención de JavaScript: 0=Dom, 1=Lun … 6=Sáb.
// La semana del programa corre de LUNES a DOMINGO.
const LUN = 1, MAR = 2, MIE = 3, JUE = 4, VIE = 5, SAB = 6, DOM = 0;

describe('clientStatus', () => {
  it('un alumno sin plan no es una alerta', () => {
    expect(clientStatus({
      hasPlan: false, plannedWeekDays: [], completedWeekDays: [], todayWeekDay: MIE,
    })).toEqual({ needsAttention: false, done: 0, total: 0 });
  });

  it('un día planificado que aún no llega no es alerta', () => {
    // hoy miércoles; el viernes todavía no ocurre
    expect(clientStatus({
      hasPlan: true, plannedWeekDays: [VIE], completedWeekDays: [], todayWeekDay: MIE,
    })).toEqual({ needsAttention: false, done: 0, total: 1 });
  });

  it('el día de HOY sin registrar no es alerta: está en curso', () => {
    expect(clientStatus({
      hasPlan: true, plannedWeekDays: [MIE], completedWeekDays: [], todayWeekDay: MIE,
    })).toEqual({ needsAttention: false, done: 0, total: 1 });
  });

  it('un domingo planificado NO es alerta el lunes: el domingo cierra la semana', () => {
    // Con la numeración de JS, DOM=0 < LUN=1 y una comparación ingenua lo
    // daría por pasado. En el orden Lun→Dom el domingo es el último día.
    expect(clientStatus({
      hasPlan: true, plannedWeekDays: [DOM], completedWeekDays: [], todayWeekDay: LUN,
    })).toEqual({ needsAttention: false, done: 0, total: 1 });
  });

  it('un día ya pasado y sin registrar sí es alerta', () => {
    expect(clientStatus({
      hasPlan: true, plannedWeekDays: [LUN, MIE], completedWeekDays: [], todayWeekDay: MIE,
    })).toEqual({ needsAttention: true, done: 0, total: 2 });
  });

  it('una sesión movida a otro día cuenta como cumplida', () => {
    // El lunes se registró (aunque haya sido el martes: quien arma
    // completedWeekDays ya resolvió eso). No hay alerta.
    expect(clientStatus({
      hasPlan: true, plannedWeekDays: [LUN, MIE], completedWeekDays: [LUN], todayWeekDay: MIE,
    })).toEqual({ needsAttention: false, done: 1, total: 2 });
  });

  it('la semana completa no es alerta', () => {
    expect(clientStatus({
      hasPlan: true,
      plannedWeekDays: [LUN, MIE, VIE],
      completedWeekDays: [LUN, MIE, VIE],
      todayWeekDay: SAB,
    })).toEqual({ needsAttention: false, done: 3, total: 3 });
  });

  it('un alumno con plan pero sin días planificados no es alerta', () => {
    expect(clientStatus({
      hasPlan: true, plannedWeekDays: [], completedWeekDays: [], todayWeekDay: JUE,
    })).toEqual({ needsAttention: false, done: 0, total: 0 });
  });

  it('ignora días cumplidos que no estaban planificados', () => {
    // registró un sábado que no le tocaba: no infla el conteo
    expect(clientStatus({
      hasPlan: true, plannedWeekDays: [LUN], completedWeekDays: [LUN, SAB], todayWeekDay: MAR,
    })).toEqual({ needsAttention: false, done: 1, total: 1 });
  });

  it('no cuenta dos veces un día repetido', () => {
    expect(clientStatus({
      hasPlan: true, plannedWeekDays: [LUN], completedWeekDays: [LUN, LUN], todayWeekDay: MAR,
    })).toEqual({ needsAttention: false, done: 1, total: 1 });
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

```bash
cd web && npm test
```

Esperado: FALLA — no existe el módulo `../clientStatus`.

- [ ] **Step 3: Implementar `clientStatus`**

Crear `web/src/lib/clientStatus.ts`:

```ts
// ¿Este alumno necesita que el coach haga algo?
//
// La regla se ajusta al plan de CADA alumno en vez de usar un número fijo de
// días: quien entrena dos veces por semana no debe aparecer como alerta por
// no entrenar un martes.
//
// Espejo exacto de trainer-app/src/lib/clientStatus.ts — los valores deben
// coincidir para las mismas entradas.

export interface ClientStatusInput {
  /** ¿tiene un plan con una semana activa? */
  hasPlan: boolean;
  /** días de la semana planificados (0=Dom … 6=Sáb) */
  plannedWeekDays: number[];
  /** días planificados cuya sesión ya se registró en cualquier día de la semana */
  completedWeekDays: number[];
  /** hoy (0=Dom … 6=Sáb) */
  todayWeekDay: number;
}

export interface ClientStatus {
  needsAttention: boolean;
  done: number;
  total: number;
}

/**
 * Posición en el orden LUNES→DOMINGO (0..6).
 *
 * `week_day` viene con la numeración de JavaScript (domingo = 0), pero la
 * semana del programa empieza el lunes. Sin esta conversión, un domingo
 * planificado se daría por "pasado" cada lunes por la mañana.
 */
const posEnSemana = (weekDay: number): number => (weekDay + 6) % 7;

export function clientStatus(input: ClientStatusInput): ClientStatus {
  const { hasPlan, plannedWeekDays, completedWeekDays, todayWeekDay } = input;

  if (!hasPlan) return { needsAttention: false, done: 0, total: 0 };

  const planificados = Array.from(new Set(plannedWeekDays));
  const cumplidos = new Set(completedWeekDays.filter((d) => planificados.includes(d)));

  const hoyPos = posEnSemana(todayWeekDay);
  // El día de hoy nunca cuenta como perdido: mientras transcurre está pendiente.
  const needsAttention = planificados.some(
    (d) => posEnSemana(d) < hoyPos && !cumplidos.has(d),
  );

  return { needsAttention, done: cumplidos.size, total: planificados.length };
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

```bash
cd web && npm test
```

Esperado: PASA. 50 tests en total (40 previos + 10 nuevos).

- [ ] **Step 5: Agregar `santiagoWeekDay` con su test**

Al final de `web/src/lib/weeks.ts`:

```ts
/**
 * Día de la semana (0=Dom … 6=Sáb) en Chile continental. El servidor de
 * Vercel corre en UTC, así que `new Date().getDay()` daría el día equivocado
 * durante las últimas horas de cada noche chilena.
 */
export function santiagoWeekDay(instant: Date = new Date()): number {
  const [y, m, d] = santiagoDayKey(instant).split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}
```

Agregar al final de `web/src/lib/__tests__/weeks.test.ts` (y sumar `santiagoWeekDay` a la lista de imports que ya está al inicio del archivo):

```ts
describe('santiagoWeekDay', () => {
  it('un instante UTC de madrugada corresponde al día anterior en Chile', () => {
    // 2026-08-13T02:00:00Z = 2026-08-12 22:00 en Santiago (miércoles)
    expect(santiagoWeekDay(new Date('2026-08-13T02:00:00Z'))).toBe(3);
  });

  it('un instante UTC de mediodía es el mismo día en Chile', () => {
    // 2026-08-13T15:00:00Z = 2026-08-13 11:00 en Santiago (jueves)
    expect(santiagoWeekDay(new Date('2026-08-13T15:00:00Z'))).toBe(4);
  });
});
```

- [ ] **Step 6: Correr los tests y verificar los tipos**

```bash
cd web && npm test && npx tsc --noEmit -p .
```

Esperado: 52 tests pasan, sin errores de tipos.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/clientStatus.ts web/src/lib/__tests__/clientStatus.test.ts web/src/lib/weeks.ts web/src/lib/__tests__/weeks.test.ts
git commit -m "feat(web): lógica de estado del alumno (necesita atención según su propio plan)"
```

---

### Task 2: `clientStatus` en la app

Espejo exacto de la Tarea 1. Se duplica a propósito: `web/` y `trainer-app/` son proyectos npm separados sin paquete compartido.

**Files:**
- Create: `trainer-app/src/lib/clientStatus.ts`
- Test: `trainer-app/src/lib/__tests__/clientStatus.test.ts`

**Interfaces:**
- Consumes: nada de tareas anteriores (módulo independiente)
- Produces: `clientStatus(input: ClientStatusInput): ClientStatus` y los tipos `ClientStatusInput`, `ClientStatus` — idénticos a los de la web

- [ ] **Step 1: Escribir los tests que fallan**

Crear `trainer-app/src/lib/__tests__/clientStatus.test.ts` con **los mismos casos y los mismos valores esperados** que la web (la paridad es el requisito, y estos tests son cómo se verifica):

```ts
import { clientStatus } from '../clientStatus';

const LUN = 1, MAR = 2, MIE = 3, JUE = 4, VIE = 5, SAB = 6, DOM = 0;

describe('clientStatus', () => {
  it('un alumno sin plan no es una alerta', () => {
    expect(clientStatus({
      hasPlan: false, plannedWeekDays: [], completedWeekDays: [], todayWeekDay: MIE,
    })).toEqual({ needsAttention: false, done: 0, total: 0 });
  });

  it('un día planificado que aún no llega no es alerta', () => {
    expect(clientStatus({
      hasPlan: true, plannedWeekDays: [VIE], completedWeekDays: [], todayWeekDay: MIE,
    })).toEqual({ needsAttention: false, done: 0, total: 1 });
  });

  it('el día de HOY sin registrar no es alerta: está en curso', () => {
    expect(clientStatus({
      hasPlan: true, plannedWeekDays: [MIE], completedWeekDays: [], todayWeekDay: MIE,
    })).toEqual({ needsAttention: false, done: 0, total: 1 });
  });

  it('un domingo planificado NO es alerta el lunes: el domingo cierra la semana', () => {
    expect(clientStatus({
      hasPlan: true, plannedWeekDays: [DOM], completedWeekDays: [], todayWeekDay: LUN,
    })).toEqual({ needsAttention: false, done: 0, total: 1 });
  });

  it('un día ya pasado y sin registrar sí es alerta', () => {
    expect(clientStatus({
      hasPlan: true, plannedWeekDays: [LUN, MIE], completedWeekDays: [], todayWeekDay: MIE,
    })).toEqual({ needsAttention: true, done: 0, total: 2 });
  });

  it('una sesión movida a otro día cuenta como cumplida', () => {
    expect(clientStatus({
      hasPlan: true, plannedWeekDays: [LUN, MIE], completedWeekDays: [LUN], todayWeekDay: MIE,
    })).toEqual({ needsAttention: false, done: 1, total: 2 });
  });

  it('la semana completa no es alerta', () => {
    expect(clientStatus({
      hasPlan: true,
      plannedWeekDays: [LUN, MIE, VIE],
      completedWeekDays: [LUN, MIE, VIE],
      todayWeekDay: SAB,
    })).toEqual({ needsAttention: false, done: 3, total: 3 });
  });

  it('un alumno con plan pero sin días planificados no es alerta', () => {
    expect(clientStatus({
      hasPlan: true, plannedWeekDays: [], completedWeekDays: [], todayWeekDay: JUE,
    })).toEqual({ needsAttention: false, done: 0, total: 0 });
  });

  it('ignora días cumplidos que no estaban planificados', () => {
    expect(clientStatus({
      hasPlan: true, plannedWeekDays: [LUN], completedWeekDays: [LUN, SAB], todayWeekDay: MAR,
    })).toEqual({ needsAttention: false, done: 1, total: 1 });
  });

  it('no cuenta dos veces un día repetido', () => {
    expect(clientStatus({
      hasPlan: true, plannedWeekDays: [LUN], completedWeekDays: [LUN, LUN], todayWeekDay: MAR,
    })).toEqual({ needsAttention: false, done: 1, total: 1 });
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

```bash
cd trainer-app && npx jest src/lib/__tests__/clientStatus.test.ts
```

Esperado: FALLA — no existe `../clientStatus`.

- [ ] **Step 3: Implementar (mismo contenido que la web)**

Crear `trainer-app/src/lib/clientStatus.ts`:

```ts
// ¿Este alumno necesita que el coach haga algo?
//
// La regla se ajusta al plan de CADA alumno en vez de usar un número fijo de
// días: quien entrena dos veces por semana no debe aparecer como alerta por
// no entrenar un martes.
//
// Espejo exacto de web/src/lib/clientStatus.ts — los valores deben coincidir
// para las mismas entradas.

export interface ClientStatusInput {
  /** ¿tiene un plan con una semana activa? */
  hasPlan: boolean;
  /** días de la semana planificados (0=Dom … 6=Sáb) */
  plannedWeekDays: number[];
  /** días planificados cuya sesión ya se registró en cualquier día de la semana */
  completedWeekDays: number[];
  /** hoy (0=Dom … 6=Sáb) */
  todayWeekDay: number;
}

export interface ClientStatus {
  needsAttention: boolean;
  done: number;
  total: number;
}

/**
 * Posición en el orden LUNES→DOMINGO (0..6).
 *
 * `week_day` viene con la numeración de JavaScript (domingo = 0), pero la
 * semana del programa empieza el lunes. Sin esta conversión, un domingo
 * planificado se daría por "pasado" cada lunes por la mañana.
 */
const posEnSemana = (weekDay: number): number => (weekDay + 6) % 7;

export function clientStatus(input: ClientStatusInput): ClientStatus {
  const { hasPlan, plannedWeekDays, completedWeekDays, todayWeekDay } = input;

  if (!hasPlan) return { needsAttention: false, done: 0, total: 0 };

  const planificados = Array.from(new Set(plannedWeekDays));
  const cumplidos = new Set(completedWeekDays.filter((d) => planificados.includes(d)));

  const hoyPos = posEnSemana(todayWeekDay);
  // El día de hoy nunca cuenta como perdido: mientras transcurre está pendiente.
  const needsAttention = planificados.some(
    (d) => posEnSemana(d) < hoyPos && !cumplidos.has(d),
  );

  return { needsAttention, done: cumplidos.size, total: planificados.length };
}
```

- [ ] **Step 4: Correr toda la suite y verificar tipos**

```bash
cd trainer-app && npx jest && npx tsc --noEmit -p .
```

Esperado: 35 tests pasan (25 previos + 10 nuevos), sin errores de tipos.

- [ ] **Step 5: Verificar la paridad a mano**

Comparar los dos archivos: el cuerpo de `clientStatus` y de `posEnSemana` debe ser idéntico palabra por palabra.

```bash
diff <(sed -n '/^const posEnSemana/,$p' trainer-app/src/lib/clientStatus.ts) \
     <(sed -n '/^const posEnSemana/,$p' web/src/lib/clientStatus.ts) && echo "IDÉNTICOS"
```

Esperado: imprime `IDÉNTICOS` sin diferencias.

- [ ] **Step 6: Commit**

```bash
git add trainer-app/src/lib/clientStatus.ts trainer-app/src/lib/__tests__/clientStatus.test.ts
git commit -m "feat(app): lógica de estado del alumno, espejo de la web"
```

---

### Task 3: El token ámbar

La única excepción al monocromo. Se hace en una tarea propia para que quede como un cambio revisable y aislado.

**Files:**
- Modify: `trainer-app/src/theme/index.ts`
- Modify: `web/src/app/globals.css`

**Interfaces:**
- Produces: `colors.warning` (app, `#c9a227`) y `var(--warning)` (web, `#c9a227`) — las tareas 4 a 7 los usan

- [ ] **Step 1: Cambiar el token en la app**

En `trainer-app/src/theme/index.ts`, dentro de `colors`, reemplazar la línea `warning: '#949DA6',` por:

```ts
  // Única excepción al monocromo: se reserva EXCLUSIVAMENTE para "esto
  // requiere que hagas algo". Por ser el único color de la app, no se puede
  // ignorar; si se empieza a usar para decorar, pierde todo su valor.
  warning: '#C9A227',
```

**No tocar `danger`, `success`, `info` ni ningún otro token.** Que `danger` sea gris es una decisión documentada en el comentario al inicio de ese mismo archivo.

- [ ] **Step 2: Agregar el token en la web**

En `web/src/app/globals.css`, dentro del bloque `:root`, agregar después de la línea `--danger: #626b73;`:

```css
  /* Única excepción al monocromo: solo para "esto requiere que hagas algo". */
  --warning: #c9a227;
```

- [ ] **Step 3: Verificar que nada se rompió**

```bash
cd trainer-app && npx tsc --noEmit -p . && cd ../web && npx tsc --noEmit -p . && npm test
```

Esperado: sin errores de tipos en ninguno, 52 tests de la web pasan.

- [ ] **Step 4: Confirmar que ningún otro token cambió**

```bash
cd /Users/sebastianazocarmondaca/Desktop/APP_trainer
git diff --unified=0 trainer-app/src/theme/index.ts web/src/app/globals.css | grep '^[-+]' | grep -v '^[-+][-+]'
```

Esperado: solo la línea `warning`/`--warning` (y sus comentarios). Si aparece cualquier otro token, revertirlo.

- [ ] **Step 5: Commit**

```bash
git add trainer-app/src/theme/index.ts web/src/app/globals.css
git commit -m "feat: token ámbar de alerta, única excepción al monocromo"
```

---

### Task 4: Carga en bloque de la lista del coach (web)

**Files:**
- Create: `web/src/lib/coachDashboard.ts`

**Interfaces:**
- Consumes: `clientStatus`, `ClientStatus` (Tarea 1); `santiagoWeekDay` (Tarea 1); `resolveActiveWeek`, `PlanWeek` (ya existen en `web/src/lib/planWeeks.ts`); `getCurrentWeek` (ya existe en `web/src/lib/weeks.ts`)
- Produces: `loadCoachDashboard(supabase, coachId): Promise<CoachDashboardRow[]>` y el tipo `CoachDashboardRow`

- [ ] **Step 1: Crear el módulo de carga**

Crear `web/src/lib/coachDashboard.ts`:

```ts
import { clientStatus, type ClientStatus } from './clientStatus';
import { resolveActiveWeek, type PlanWeek } from './planWeeks';
import { getCurrentWeek, santiagoWeekDay, santiagoDayKey } from './weeks';

// Datos de la lista de alumnos del coach, cargados EN BLOQUE.
//
// Regla que no se puede romper: el número de consultas es fijo y ningún
// `.in(...)` recibe una lista que crezca con el número de series del plan.
// Los registros se piden por `logged_by` (un id por alumno, ~30) en vez de
// por `series_id` (miles) — pedirlos por serie es exactamente el error que
// hizo fallar en silencio al calendario y dibujar el mes como "nadie entrenó".

export interface CoachDashboardRow {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  status: ClientStatus;
  /** "YYYY-MM-DD" del último entrenamiento dentro de las 2 semanas miradas, o null */
  lastTrainedKey: string | null;
}

export async function loadCoachDashboard(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  coachId: string,
): Promise<CoachDashboardRow[]> {
  const { data: clients } = await supabase
    .from('users')
    .select('id, name, email, avatar_url')
    .eq('role', 'client')
    .eq('coach_id', coachId)
    .order('name');

  const list = (clients ?? []) as { id: string; name: string; email: string; avatar_url: string | null }[];
  if (list.length === 0) return [];

  const clientIds = list.map((c) => c.id);
  const currentWeek = getCurrentWeek();
  const todayWeekDay = santiagoWeekDay();

  // 1) planes de esos alumnos
  const { data: plans } = await supabase
    .from('workout_plans').select('id, client_id').in('client_id', clientIds);
  const planByClient = new Map<string, string>();
  (plans ?? []).forEach((p: any) => planByClient.set(p.client_id, p.id));
  const planIds = Array.from(planByClient.values());

  // 2) semanas de esos planes -> la activa de cada uno
  const { data: weeks } = planIds.length
    ? await supabase.from('plan_weeks').select('*').in('plan_id', planIds).eq('archived', false)
    : { data: [] };
  const weeksByPlan = new Map<string, PlanWeek[]>();
  ((weeks ?? []) as PlanWeek[]).forEach((w) => {
    weeksByPlan.set(w.plan_id, [...(weeksByPlan.get(w.plan_id) ?? []), w]);
  });
  const activeWeekByPlan = new Map<string, string>();
  planIds.forEach((planId) => {
    const active = resolveActiveWeek(weeksByPlan.get(planId) ?? [], currentWeek);
    if (active) activeWeekByPlan.set(planId, active.id);
  });

  // 3) días de las semanas activas, con sus ejercicios y series
  const activeWeekIds = Array.from(activeWeekByPlan.values());
  const { data: days } = activeWeekIds.length
    ? await supabase
        .from('training_days')
        .select('id, plan_id, name, week_day, archived, exercises ( id, archived, exercise_series ( id ) )')
        .in('plan_week_id', activeWeekIds)
    : { data: [] };

  // 4) registros de las 2 últimas semanas, acotados por ALUMNO (no por serie)
  const { data: logs, error: logsError } = await supabase
    .from('workout_logs')
    .select('series_id, logged_by, logged_at, week_number')
    .in('logged_by', clientIds)
    .in('week_number', [currentWeek - 1, currentWeek]);

  // Un fallo acá NO puede disfrazarse de "nadie entrenó": se propaga.
  if (logsError) throw new Error(`No se pudieron cargar los registros: ${logsError.message}`);

  // series_id -> día planificado
  const dayBySeries = new Map<string, { dayId: string; planId: string; weekDay: number | null }>();
  const plannedByPlan = new Map<string, number[]>();
  ((days ?? []) as any[])
    .filter((d) => !d.archived && !d.name.toLowerCase().includes('libre'))
    .forEach((d) => {
      if (d.week_day != null) {
        plannedByPlan.set(d.plan_id, [...(plannedByPlan.get(d.plan_id) ?? []), d.week_day]);
      }
      (d.exercises ?? []).filter((e: any) => !e.archived).forEach((e: any) => {
        (e.exercise_series ?? []).forEach((s: any) => {
          dayBySeries.set(s.id, { dayId: d.id, planId: d.plan_id, weekDay: d.week_day });
        });
      });
    });

  // Un día planificado está cumplido si ALGUNO de sus ejercicios tiene un
  // registro en la semana en curso — sin importar en qué día lo hizo, que es
  // el mismo criterio que usa el calendario.
  const completedByPlan = new Map<string, Set<number>>();
  const lastTrainedByClient = new Map<string, string>();
  ((logs ?? []) as any[]).forEach((l) => {
    if (l.logged_at) {
      const key = santiagoDayKey(new Date(l.logged_at));
      const prev = lastTrainedByClient.get(l.logged_by);
      if (!prev || key > prev) lastTrainedByClient.set(l.logged_by, key);
    }
    if (l.week_number !== currentWeek) return;
    const meta = dayBySeries.get(l.series_id);
    if (!meta || meta.weekDay == null) return;
    const set = completedByPlan.get(meta.planId) ?? new Set<number>();
    set.add(meta.weekDay);
    completedByPlan.set(meta.planId, set);
  });

  return list.map((c) => {
    const planId = planByClient.get(c.id);
    const hasPlan = !!planId && activeWeekByPlan.has(planId);
    return {
      ...c,
      status: clientStatus({
        hasPlan,
        plannedWeekDays: planId ? plannedByPlan.get(planId) ?? [] : [],
        completedWeekDays: planId ? Array.from(completedByPlan.get(planId) ?? []) : [],
        todayWeekDay,
      }),
      lastTrainedKey: lastTrainedByClient.get(c.id) ?? null,
    };
  });
}
```

- [ ] **Step 2: Verificar los tipos**

```bash
cd web && npx tsc --noEmit -p .
```

Esperado: sin salida.

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/coachDashboard.ts
git commit -m "feat(web): carga en bloque del estado de los alumnos del coach"
```

---

### Task 5: Dashboard de la web con estado

**Files:**
- Modify: `web/src/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `loadCoachDashboard(supabase, coachId)` y `CoachDashboardRow` (Tarea 4); `var(--warning)` (Tarea 3); `santiagoDayKey` (ya existe)
- Produces: nada nuevo

- [ ] **Step 1: Reemplazar la consulta de clientes por la carga en bloque**

En `web/src/app/dashboard/page.tsx`, agregar a los imports:

```tsx
import { loadCoachDashboard, type CoachDashboardRow } from '@/lib/coachDashboard';
import { santiagoDayKey } from '@/lib/weeks';
```

Reemplazar este bloque:

```tsx
  const { data: clients } = await supabase
    .from('users')
    .select('id, name, email, avatar_url')
    .eq('role', 'client')
    .eq('coach_id', user.id)
    .order('name');

  const list = (clients ?? []) as AppUser[];
```

por:

```tsx
  const list: CoachDashboardRow[] = await loadCoachDashboard(supabase, user.id);
  const atencion = list.filter((c) => c.status.needsAttention);
  const alDia = list.filter((c) => !c.status.needsAttention);

  const hoyKey = santiagoDayKey(new Date());
  const ayerKey = santiagoDayKey(new Date(Date.now() - 86400000));

  function ultimaVez(row: CoachDashboardRow): string {
    if (!row.lastTrainedKey) return 'sin registros en 2 semanas';
    if (row.lastTrainedKey === hoyKey) return 'entrenó hoy';
    if (row.lastTrainedKey === ayerKey) return 'entrenó ayer';
    const dias = Math.round(
      (new Date(hoyKey).getTime() - new Date(row.lastTrainedKey).getTime()) / 86400000,
    );
    return `hace ${dias} días`;
  }

  function detalle(row: CoachDashboardRow): string {
    if (row.status.total === 0) return 'sin plan asignado';
    return `${row.status.done} de ${row.status.total} días · ${ultimaVez(row)}`;
  }
```

- [ ] **Step 2: Renderizar los dos grupos**

Reemplazar el bloque que hoy recorre `list` para pintar las tarjetas de cliente por:

```tsx
        {list.length === 0 ? (
          <p className="muted" style={{ marginTop: 30 }}>
            Todavía no tienes alumnos. Invita al primero con “+ Cliente”.
          </p>
        ) : (
          <>
            {atencion.length > 0 && (
              <>
                <span className="label" style={{ color: 'var(--warning)', letterSpacing: 2 }}>
                  Necesitan atención
                </span>
                <div className="client-grid" style={{ marginTop: 12, marginBottom: 28 }}>
                  {atencion.map((c) => (
                    <Link
                      key={c.id}
                      href={`/clients/${c.id}`}
                      className="client-card"
                      style={{ borderColor: 'var(--warning)' }}
                    >
                      <div className="avatar">{(c.name?.[0] ?? '?').toUpperCase()}</div>
                      <h3>{c.name}</h3>
                      <small style={{ color: 'var(--warning)' }}>{detalle(c)}</small>
                    </Link>
                  ))}
                </div>
              </>
            )}

            {alDia.length > 0 && (
              <>
                <span className="label muted" style={{ letterSpacing: 2 }}>
                  {atencion.length > 0 ? 'Al día' : 'Mis alumnos'}
                </span>
                <div className="client-grid" style={{ marginTop: 12 }}>
                  {alDia.map((c) => (
                    <Link key={c.id} href={`/clients/${c.id}`} className="client-card">
                      <div className="avatar">{(c.name?.[0] ?? '?').toUpperCase()}</div>
                      <h3>{c.name}</h3>
                      <small>{detalle(c)}</small>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </>
        )}
```

Si el archivo dejó de usar el tipo `AppUser`, quitar ese import; si lo sigue usando para `me`, dejarlo.

- [ ] **Step 3: Verificar tipos y build**

```bash
cd web && npx tsc --noEmit -p . && npm test && npx next build
```

Esperado: sin errores de tipos, 52 tests pasan, build exitoso.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/dashboard/page.tsx
git commit -m "feat(web): la lista de alumnos muestra quién necesita atención"
```

---

### Task 6: Ficha del cliente en la web: grupos y nombres

**Files:**
- Modify: `web/src/app/clients/[id]/page.tsx`
- Modify: `web/src/app/clients/[id]/week/page.tsx`
- Modify: `web/src/app/clients/[id]/progress/page.tsx`
- Modify: `web/src/app/clients/[id]/calendar/page.tsx`
- Modify: `web/src/app/clients/[id]/exercise/[exerciseId]/page.tsx`

**Interfaces:**
- Consumes: las rutas existentes `/clients/[id]`, `/clients/[id]/week`, `/clients/[id]/calendar`, `/clients/[id]/progress`
- Produces: nada nuevo (solo texto de enlaces y agrupación)

- [ ] **Step 1: Renombrar los enlaces en las cuatro páginas secundarias**

En cada uno de estos archivos, cambiar el texto de los enlaces del header (las rutas NO cambian):

- `web/src/app/clients/[id]/week/page.tsx`: `EVOLUCIÓN` → `POR EJERCICIO`
- `web/src/app/clients/[id]/progress/page.tsx`: `SEMANA A SEMANA` → `ESTA SEMANA`
- `web/src/app/clients/[id]/calendar/page.tsx`: `SEMANA A SEMANA` → `ESTA SEMANA`
- `web/src/app/clients/[id]/exercise/[exerciseId]/page.tsx`: `← SEMANA A SEMANA` → `← ESTA SEMANA`

- [ ] **Step 2: Agrupar los accesos en la ficha del cliente**

En `web/src/app/clients/[id]/page.tsx`, reemplazar el `<div style={{ display: 'flex', gap: 10 }}>` del header (el que contiene CALENDARIO, SEMANA A SEMANA, EVOLUCIÓN y ← CLIENTES) por solo el enlace de volver:

```tsx
          <Link href="/dashboard" className="btn btn-ghost" style={{ padding: '10px 18px' }}>
            ← CLIENTES
          </Link>
```

Y dentro de `<main>`, justo después del `<h1>` con el nombre del cliente y antes del bloque de `WeekManager`/`PlanEditor`, insertar los grupos:

```tsx
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 22 }}>
          <div>
            <span className="label muted" style={{ letterSpacing: 2 }}>Cómo va</span>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <Link href={`/clients/${id}/week`} className="btn btn-ghost" style={{ padding: '10px 16px' }}>
                ESTA SEMANA
              </Link>
              <Link href={`/clients/${id}/calendar`} className="btn btn-ghost" style={{ padding: '10px 16px' }}>
                CALENDARIO
              </Link>
              <Link href={`/clients/${id}/progress`} className="btn btn-ghost" style={{ padding: '10px 16px' }}>
                POR EJERCICIO
              </Link>
            </div>
          </div>

          <div>
            <span className="label muted" style={{ letterSpacing: 2 }}>Qué va a hacer</span>
            <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
              Su plan y sus semanas se editan aquí abajo.
            </p>
          </div>
        </div>
```

**Nota:** en la web no hay pantalla de "Medidas y fotos" ni de chat — existen solo en la app. Por eso el grupo "Hablar" no aparece acá y "Cómo va" tiene tres entradas en vez de cuatro. No inventar esas páginas: están fuera de alcance.

- [ ] **Step 3: Verificar tipos y build**

```bash
cd web && npx tsc --noEmit -p . && npx next build
```

Esperado: sin errores, build exitoso con todas las rutas de `/clients/[id]` presentes.

- [ ] **Step 4: Commit**

```bash
git add "web/src/app/clients/[id]"
git commit -m "feat(web): accesos del cliente agrupados por intención y renombrados"
```

---

### Task 7: Carga en bloque + lista del coach en la app

**Files:**
- Create: `trainer-app/src/lib/coachDashboard.ts`
- Modify: `trainer-app/src/screens/coach/ClientListScreen.tsx`

**Interfaces:**
- Consumes: `clientStatus`, `ClientStatus` (Tarea 2); `resolveActiveWeek`, `PlanWeek` (ya existen en `trainer-app/src/lib/plan.ts`); `getCurrentWeek` (ya existe en `trainer-app/src/lib/weeks.ts`); `colors.warning` (Tarea 3)
- Produces: `loadCoachDashboard(coachId): Promise<CoachDashboardRow[]>` y `CoachDashboardRow`

**La firma es distinta a la de la web a propósito, no es un descuido:** la web recibe el cliente de Supabase como argumento porque cada petición del servidor crea el suyo con las cookies de esa sesión; la app importa un cliente único ya autenticado. Mismo algoritmo, misma salida, distinta forma de obtener el cliente.

- [ ] **Step 1: Crear el módulo de carga**

Crear `trainer-app/src/lib/coachDashboard.ts`. Es el mismo algoritmo que la versión web, adaptado al cliente de Supabase de la app (que se importa, no se recibe) y a la zona horaria del teléfono:

```ts
import { supabase } from './supabase';
import { clientStatus, ClientStatus } from './clientStatus';
import { resolveActiveWeek, PlanWeek } from './plan';
import { getCurrentWeek } from './weeks';

// Estado de los alumnos del coach, cargado EN BLOQUE.
//
// Regla que no se puede romper: el número de consultas es fijo y ningún
// `.in(...)` recibe una lista que crezca con el número de series del plan.
// Los registros se piden por `logged_by` (un id por alumno) en vez de por
// `series_id` (miles).
//
// A diferencia de la web, acá las fechas usan la zona del teléfono, que es
// la del propio coach — igual que el resto de la app.

export interface CoachDashboardRow {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  status: ClientStatus;
  /** "YYYY-MM-DD" del último entrenamiento dentro de las 2 semanas miradas, o null */
  lastTrainedKey: string | null;
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function loadCoachDashboard(coachId: string): Promise<CoachDashboardRow[]> {
  const { data: clients } = await supabase
    .from('users').select('id, name, email, avatar_url')
    .eq('role', 'client').eq('coach_id', coachId).order('name');

  // Ojo: lo que vuelve de la consulta NO es todavía un CoachDashboardRow —
  // le faltan `status` y `lastTrainedKey`, que se calculan más abajo.
  const list = (clients ?? []) as { id: string; name: string; email: string; avatar_url: string | null }[];
  if (list.length === 0) return [];

  const clientIds = list.map(c => c.id);
  const currentWeek = getCurrentWeek();
  const todayWeekDay = new Date().getDay();

  const { data: plans } = await supabase
    .from('workout_plans').select('id, client_id').in('client_id', clientIds);
  const planByClient = new Map<string, string>();
  (plans ?? []).forEach((p: any) => planByClient.set(p.client_id, p.id));
  const planIds = Array.from(planByClient.values());

  const { data: weeks } = planIds.length
    ? await supabase.from('plan_weeks').select('*').in('plan_id', planIds).eq('archived', false)
    : { data: [] };
  const weeksByPlan = new Map<string, PlanWeek[]>();
  ((weeks ?? []) as PlanWeek[]).forEach(w => {
    weeksByPlan.set(w.plan_id, [...(weeksByPlan.get(w.plan_id) ?? []), w]);
  });
  const activeWeekByPlan = new Map<string, string>();
  planIds.forEach(planId => {
    const active = resolveActiveWeek(weeksByPlan.get(planId) ?? [], currentWeek);
    if (active) activeWeekByPlan.set(planId, active.id);
  });

  const activeWeekIds = Array.from(activeWeekByPlan.values());
  const { data: days } = activeWeekIds.length
    ? await supabase
        .from('training_days')
        .select('id, plan_id, name, week_day, archived, exercises ( id, archived, exercise_series ( id ) )')
        .in('plan_week_id', activeWeekIds)
    : { data: [] };

  const { data: logs, error: logsError } = await supabase
    .from('workout_logs')
    .select('series_id, logged_by, logged_at, week_number')
    .in('logged_by', clientIds)
    .in('week_number', [currentWeek - 1, currentWeek]);

  // Un fallo acá NO puede disfrazarse de "nadie entrenó".
  if (logsError) throw new Error(`No se pudieron cargar los registros: ${logsError.message}`);

  const dayBySeries = new Map<string, { planId: string; weekDay: number | null }>();
  const plannedByPlan = new Map<string, number[]>();
  ((days ?? []) as any[])
    .filter(d => !d.archived && !d.name.toLowerCase().includes('libre'))
    .forEach(d => {
      if (d.week_day != null) {
        plannedByPlan.set(d.plan_id, [...(plannedByPlan.get(d.plan_id) ?? []), d.week_day]);
      }
      (d.exercises ?? []).filter((e: any) => !e.archived).forEach((e: any) => {
        (e.exercise_series ?? []).forEach((s: any) => {
          dayBySeries.set(s.id, { planId: d.plan_id, weekDay: d.week_day });
        });
      });
    });

  const completedByPlan = new Map<string, Set<number>>();
  const lastTrainedByClient = new Map<string, string>();
  ((logs ?? []) as any[]).forEach(l => {
    if (l.logged_at) {
      const key = dayKey(new Date(l.logged_at));
      const prev = lastTrainedByClient.get(l.logged_by);
      if (!prev || key > prev) lastTrainedByClient.set(l.logged_by, key);
    }
    if (l.week_number !== currentWeek) return;
    const meta = dayBySeries.get(l.series_id);
    if (!meta || meta.weekDay == null) return;
    const set = completedByPlan.get(meta.planId) ?? new Set<number>();
    set.add(meta.weekDay);
    completedByPlan.set(meta.planId, set);
  });

  return list.map(c => {
    const planId = planByClient.get(c.id);
    const hasPlan = !!planId && activeWeekByPlan.has(planId);
    return {
      ...c,
      status: clientStatus({
        hasPlan,
        plannedWeekDays: planId ? plannedByPlan.get(planId) ?? [] : [],
        completedWeekDays: planId ? Array.from(completedByPlan.get(planId) ?? []) : [],
        todayWeekDay,
      }),
      lastTrainedKey: lastTrainedByClient.get(c.id) ?? null,
    };
  });
}
```

- [ ] **Step 2: Usar la carga nueva en la pantalla**

En `trainer-app/src/screens/coach/ClientListScreen.tsx`:

1. Agregar los imports `import { loadCoachDashboard, CoachDashboardRow } from '../../lib/coachDashboard';`
2. Cambiar el estado de la lista de clientes para que guarde `CoachDashboardRow[]` y se llene con `await loadCoachDashboard(user.id)` en vez de la consulta actual a `users`.
3. Reemplazar la `FlatList` única por dos secciones. Cada tarjeta muestra el detalle bajo el nombre en vez del texto fijo "Ver plan de entrenamiento →":

```tsx
  const hoy = new Date();
  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hoyKey = dayKey(hoy);
  const ayerKey = dayKey(new Date(hoy.getTime() - 86400000));

  function ultimaVez(row: CoachDashboardRow) {
    if (!row.lastTrainedKey) return 'sin registros en 2 semanas';
    if (row.lastTrainedKey === hoyKey) return 'entrenó hoy';
    if (row.lastTrainedKey === ayerKey) return 'entrenó ayer';
    const dias = Math.round(
      (new Date(hoyKey).getTime() - new Date(row.lastTrainedKey).getTime()) / 86400000,
    );
    return `hace ${dias} días`;
  }

  function detalle(row: CoachDashboardRow) {
    if (row.status.total === 0) return 'sin plan asignado';
    return `${row.status.done} de ${row.status.total} días · ${ultimaVez(row)}`;
  }

  const atencion = clients.filter(c => c.status.needsAttention);
  const alDia = clients.filter(c => !c.status.needsAttention);
```

Y en el render, en lugar de la `FlatList` actual, una `ScrollView` con las dos secciones:

```tsx
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {clients.length === 0 && (
            <Text style={styles.emptyText}>No hay clientes aún</Text>
          )}

          {atencion.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.warning }]}>NECESITAN ATENCIÓN</Text>
              {atencion.map(item => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => navigation.navigate('ClientDetail', { client: item })}
                  activeOpacity={0.7}
                >
                  <Card style={{ ...styles.clientCard, borderColor: colors.warning }}>
                    <Avatar name={item.name} imageUrl={item.avatar_url} size={52} accent />
                    <View style={styles.clientInfo}>
                      <Text style={styles.clientName}>{item.name}</Text>
                      <Text style={[styles.clientSub, { color: colors.warning }]}>{detalle(item)}</Text>
                    </View>
                  </Card>
                </TouchableOpacity>
              ))}
            </>
          )}

          {alDia.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>{atencion.length > 0 ? 'AL DÍA' : 'CLIENTES'}</Text>
              {alDia.map(item => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => navigation.navigate('ClientDetail', { client: item })}
                  activeOpacity={0.7}
                >
                  <Card style={styles.clientCard}>
                    <Avatar name={item.name} imageUrl={item.avatar_url} size={52} accent />
                    <View style={styles.clientInfo}>
                      <Text style={styles.clientName}>{item.name}</Text>
                      <Text style={styles.clientSub}>{detalle(item)}</Text>
                    </View>
                  </Card>
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>
```

Importar `ScrollView` desde `react-native` si no está ya, y quitar `FlatList` de los imports si deja de usarse.

- [ ] **Step 3: Poner texto a los iconos del header**

En la misma pantalla, la fila de iconos (`styles.headerIcons`) hoy son solo símbolos. Bajo cada `<Ionicons>` de Gimnasio, Programas, Calculadoras y Ajustes, agregar una etiqueta. Envolver cada `TouchableOpacity` de esa fila así (ejemplo con Programas, repetir el patrón para los otros tres):

```tsx
            <TouchableOpacity onPress={() => navigation.navigate('Programs')} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="clipboard-outline" size={18} color={colors.textMuted} />
              <Text style={styles.iconLabel}>PROGRAMAS</Text>
            </TouchableOpacity>
```

Etiquetas: `GIMNASIO`, `PROGRAMAS`, `CALCULAR`, `AJUSTES`. El botón de salir (`log-out-outline`) se deja **sin** etiqueta: es el único destructivo y no queremos invitar a tocarlo.

Agregar al `StyleSheet`:

```tsx
  iconLabel: { fontSize: 7.5, fontWeight: '800', letterSpacing: 0.5, color: colors.textMuted, marginTop: 2 },
```

Y en `iconBtn`, asegurarse de que tenga `alignItems: 'center'` para que la etiqueta quede centrada bajo el icono.

- [ ] **Step 4: Verificar tipos y tests**

```bash
cd trainer-app && npx tsc --noEmit -p . && npx jest
```

Esperado: sin errores de tipos, 35 tests pasan.

- [ ] **Step 5: Commit**

```bash
git add trainer-app/src/lib/coachDashboard.ts trainer-app/src/screens/coach/ClientListScreen.tsx
git commit -m "feat(app): la lista de alumnos muestra quién necesita atención y los iconos tienen texto"
```

---

### Task 8: Ficha del cliente en la app: grupos y nombres

**Files:**
- Modify: `trainer-app/src/screens/coach/ClientDetailScreen.tsx`

**Interfaces:**
- Consumes: las rutas de navegación existentes `WeekManager`, `ClientWeek`, `ClientProgress`, `ClientBody`, `Chat`
- Produces: nada nuevo

- [ ] **Step 1: Agrupar los cinco botones**

En `trainer-app/src/screens/coach/ClientDetailScreen.tsx`, reemplazar el bloque `<View style={styles.actions}>` completo (los cinco `TouchableOpacity` seguidos) por:

```tsx
          <View style={styles.actions}>
            <Text style={styles.groupLabel}>CÓMO VA</Text>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigation.navigate('ClientWeek', { client })}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>ESTA SEMANA</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSecondary]}
              onPress={() => navigation.navigate('ClientCalendar', { client })}
              activeOpacity={0.8}
            >
              <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>CALENDARIO</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSecondary]}
              onPress={() => navigation.navigate('ClientProgress', { client })}
              activeOpacity={0.8}
            >
              <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>POR EJERCICIO</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSecondary]}
              onPress={() => navigation.navigate('ClientBody', { client })}
              activeOpacity={0.8}
            >
              <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>MEDIDAS Y FOTOS</Text>
            </TouchableOpacity>

            <Text style={styles.groupLabel}>QUÉ VA A HACER</Text>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigation.navigate('WeekManager', { client })}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>PLAN Y SEMANAS</Text>
            </TouchableOpacity>

            <Text style={styles.groupLabel}>HABLAR</Text>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSecondary]}
              onPress={() => navigation.navigate('Chat', {
                peerId: client.id, peerName: client.name, peerAvatar: client.avatar_url,
                coachId: user!.id, clientId: client.id,
              })}
              activeOpacity={0.8}
            >
              <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>
                CHAT{unread > 0 ? `  ·  ${unread}` : ''}
              </Text>
            </TouchableOpacity>
          </View>
```

Agregar al `StyleSheet`:

```tsx
  groupLabel: {
    ...typography.label,
    letterSpacing: 3,
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
```

Los emojis de los botones se quitan: con las etiquetas de grupo ya no hacen falta para distinguirlos, y el estilo del resto de la app no los usa.

- [ ] **Step 2: Verificar tipos**

```bash
cd trainer-app && npx tsc --noEmit -p .
```

Esperado: un error indicando que `ClientCalendar` no existe como ruta de navegación. Es lo esperado: esa pantalla la crea la Tarea 9. **No inventar la pantalla acá.** Dejar el error anotado y continuar.

Si aparece cualquier OTRO error de tipos, corregirlo.

- [ ] **Step 3: Commit**

```bash
git add trainer-app/src/screens/coach/ClientDetailScreen.tsx
git commit -m "feat(app): accesos del cliente agrupados por intención y renombrados"
```

---

### Task 9: Calendario del alumno en la app

Paridad con la web: hoy el calendario es la única función que existe solo ahí.

**Files:**
- Create: `trainer-app/src/screens/coach/ClientCalendarScreen.tsx`
- Modify: `trainer-app/src/navigation/index.tsx`

**Interfaces:**
- Consumes: `fetchPlanWeeks(planId)`, `resolveActiveWeek(weeks, calendarWeek)`, `PlanWeek` (ya existen en `trainer-app/src/lib/plan.ts`); `getCurrentWeek`, `WEEK_DAYS_SHORT` (ya existen en `trainer-app/src/lib/weeks.ts`); `colors.warning` (Tarea 3)
- Produces: la ruta de navegación `ClientCalendar`, que la Tarea 8 ya usa

- [ ] **Step 1: Leer la versión web como referencia**

Leer `web/src/app/clients/[id]/calendar/page.tsx` completo antes de escribir nada. Esta pantalla debe comportarse igual: mismos estados por día, mismos textos, misma lógica de "movido" y "fuera de lo planificado".

Comportamientos que **no** se pueden perder al portar (todos salieron de una revisión que encontró estos defectos en la versión web):

1. Días anteriores al inicio del programa (2026-06-15) se dibujan vacíos, sin insignia de semana. No se clampean a la semana 1.
2. El día de HOY nunca se marca como perdido mientras transcurre: se muestra como pendiente.
3. Una sesión entrenada un día distinto al planificado muestra "movido al …" en el día planificado, y aparece como hecha en el día real.
4. Un día cuyos ejercicios están todos archivados (`total === 0`) no muestra insignia de cumplimiento.
5. La consulta de registros se acota a las semanas visibles, y **su error no se descarta**: si falla, se avisa en pantalla en vez de dibujar todo como "nadie entrenó".
6. La leyenda describe exactamente los estados que se dibujan.

- [ ] **Step 2: Crear la pantalla**

Crear `trainer-app/src/screens/coach/ClientCalendarScreen.tsx` siguiendo el patrón de `trainer-app/src/screens/coach/ClientWeekScreen.tsx` (cabecera con botón ATRÁS, navegación entre periodos, `ScrollView`, `StyleSheet` al final). La grilla mensual se construye con `View`s en filas de siete, no con CSS grid.

Estructura mínima:

- Cabecera: botón ATRÁS, etiqueta `CALENDARIO`, nombre del alumno en `typography.displaySm`.
- Navegación de mes: `← MES ANTERIOR`, nombre del mes y año, `MES SIGUIENTE →`, y `HOY` cuando no se está en el mes actual.
- Grilla: fila de cabecera con `LUN MAR MIÉ JUE VIE SÁB DOM`, y luego una fila `View` por semana con siete celdas.
- Cada celda: número del día, insignia `S{n}` si corresponde, y los bloques de sesión de ese día.
- Leyenda al final describiendo los estados dibujados.

La decisión de en qué estado está cada celda es donde viven los errores — la revisión de la versión web encontró cinco defectos distintos justo acá. Reproducir esta función tal cual, y construir el render sobre ella:

```ts
type Estado =
  | 'vacio'          // no hay nada planificado ni entrenado ese día
  | 'completo'       // planificado ese día y todos sus ejercicios registrados
  | 'parcial'        // planificado ese día y algunos registrados
  | 'pendiente'      // planificado hoy o en el futuro, sin registrar
  | 'movido'         // planificado ese día, pero se entrenó otro día de la semana
  | 'fuera'          // se entrenó ese día, pero estaba planificado otro
  | 'perdido';       // planificado, ya pasó, y no se registró en toda la semana

function estadoDeCelda(args: {
  /** días planificados que caen en esta fecha */
  planificadosHoy: { id: string; exerciseIds: string[] }[];
  /** días planificados de la semana que se entrenaron EN esta fecha aunque tocaban otra */
  fueraDeLoPlanificado: { id: string; exerciseIds: string[] }[];
  /** exercise_id -> registrado, por clave de día "YYYY-MM-DD" */
  hechosPorDia: Map<string, Set<string>>;
  claveDeEstaCelda: string;
  clavesDeLaSemana: string[];
  esPasado: boolean;   // estrictamente anterior a hoy; HOY nunca es pasado
  huboErrorDeConsulta: boolean;
}): Estado {
  const { planificadosHoy, fueraDeLoPlanificado, hechosPorDia,
          claveDeEstaCelda, clavesDeLaSemana, esPasado, huboErrorDeConsulta } = args;

  if (planificadosHoy.length === 0) {
    return fueraDeLoPlanificado.length > 0 ? 'fuera' : 'vacio';
  }

  const dia = planificadosHoy[0];
  const total = dia.exerciseIds.length;
  // Un día sin ejercicios activos no puede estar "perdido": no hay nada que perder.
  if (total === 0) return 'vacio';

  const hechosHoy = hechosPorDia.get(claveDeEstaCelda) ?? new Set<string>();
  const hechos = dia.exerciseIds.filter(id => hechosHoy.has(id)).length;

  if (hechos >= total) return 'completo';
  if (hechos > 0) return 'parcial';

  // ¿se entrenó esta sesión otro día de la misma semana?
  const seMovio = clavesDeLaSemana.some(k => {
    if (k === claveDeEstaCelda) return false;
    const hechosEseDia = hechosPorDia.get(k);
    return !!hechosEseDia && dia.exerciseIds.some(id => hechosEseDia.has(id));
  });
  if (seMovio) return 'movido';

  // Si la consulta de registros falló, NO acusar de perdido: no sabemos nada.
  if (esPasado && !huboErrorDeConsulta) return 'perdido';
  return 'pendiente';
}
```

Estados de una celda, con su tratamiento visual:

| Estado | Cuándo | Cómo se ve |
|---|---|---|
| Completo | todos los ejercicios del día registrados | relleno `colors.accent`, texto `colors.background` |
| Parcial | algunos registrados | borde `colors.accent`, contador `n/total` |
| Movido | la sesión se registró otro día de la semana | borde `colors.border`, texto "movido al {día}" |
| Fuera de lo planificado | se entrenó ese día pero estaba planificado otro | relleno `colors.accent` a `opacity: 0.7`, texto "✓ fuera de lo planificado" |
| Pendiente | día planificado hoy o en el futuro | borde `colors.border`, texto "pendiente" |
| Perdido | día planificado ya pasado, sin registrar en toda la semana | borde punteado `colors.warning` |

El estado "perdido" es el único que usa el ámbar: es la única celda que pide una acción del coach.

- [ ] **Step 3: Registrar la pantalla en la navegación**

En `trainer-app/src/navigation/index.tsx`, junto a los otros imports de pantallas de coach:

```tsx
import ClientCalendarScreen from '../screens/coach/ClientCalendarScreen';
```

Y en el grupo de pantallas del coach, junto a `ClientWeek`:

```tsx
            <Stack.Screen name="ClientCalendar" component={ClientCalendarScreen} />
```

- [ ] **Step 4: Verificar tipos y tests**

```bash
cd trainer-app && npx tsc --noEmit -p . && npx jest
```

Esperado: sin errores de tipos (incluido el de `ClientCalendar` que quedó pendiente de la Tarea 8), 35 tests pasan.

- [ ] **Step 5: Commit**

```bash
git add trainer-app/src/screens/coach/ClientCalendarScreen.tsx trainer-app/src/navigation/index.tsx
git commit -m "feat(app): calendario mensual del alumno, paridad con la web"
```

---

### Task 10: Verificación de punta a punta

**Files:** ninguno (solo verificación)

**Interfaces:**
- Consumes: todo lo anterior
- Produces: nada

- [ ] **Step 1: Verificación local completa**

```bash
cd web && npm test && npx tsc --noEmit -p . && npx next build
cd ../trainer-app && npx jest && npx tsc --noEmit -p .
```

Esperado: 52 tests en la web, 35 en la app, sin errores de tipos, build de la web exitoso.

- [ ] **Step 2: Confirmar que el monocromo sigue intacto**

```bash
cd /Users/sebastianazocarmondaca/Desktop/APP_trainer
git diff sandbox --unified=0 -- trainer-app/src/theme/index.ts web/src/app/globals.css | grep '^[-+]' | grep -v '^[-+][-+]'
```

Esperado: solo las líneas de `warning` / `--warning`. Cualquier otro token modificado se revierte.

- [ ] **Step 3: Verificar en el preview con datos reales**

El coordinador sube la rama, Vercel genera un preview aislado (no producción), y se verifica con la cuenta demo `appreview.coach@elitefitapp.com` / `AppleReview2026!`:

1. **Sin datos**: el dashboard muestra al alumno demo en "Al día" con "0 de 2 días · sin registros en 2 semanas" — no en "Necesitan atención", porque el lunes y el miércoles planificados aún no han pasado en la semana en curso (verificar contra el día real en que se prueba).
2. **Con un día pasado sin registrar**: el alumno sube a "Necesitan atención" con el borde ámbar.
3. **Con la semana registrada**: vuelve a "Al día" con el conteo correcto.
4. La ficha del cliente muestra los tres grupos y los enlaces llevan a las páginas correctas.

Los registros de prueba se insertan y se borran con los mismos comandos usados en planes anteriores, sobre las series del plan demo.

- [ ] **Step 4: Borrar los datos de prueba**

La cuenta demo la revisa Apple: **debe quedar sin datos inventados**. Verificar que la consulta de registros de esas series devuelve `[]` antes de dar por cerrado el paso.

- [ ] **Step 5: Build de TestFlight**

El coordinador lanza `eas build --platform ios --profile production --auto-submit`, y recuerda al dueño que la compilación debe agregarse a mano al grupo "Coaches Beta" en App Store Connect.

---

## Fuera de alcance (explícito)

- La experiencia del alumno (pestañas INICIO / HOY / PROGRESO / PERFIL). Queda para un plan aparte.
- `PlanEditorScreen`, el editor de programas y la gestión de semanas: no se tocan.
- Páginas web de "Medidas y fotos" y de chat: no existen y no se crean acá.
- Cambiar `danger`, `success` o `info`: el monocromo es una decisión documentada.
- Resolver la asimetría de zona horaria entre app (zona del teléfono) y web (Chile): es previa a este trabajo y afecta a `getCurrentWeek()`, que está fijado por paridad.
