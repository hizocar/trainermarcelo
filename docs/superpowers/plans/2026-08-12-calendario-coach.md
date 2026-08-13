# Calendario del alumno + historial de ejercicio (web) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar al coach una vista de calendario mensual por alumno en la web, donde cada día muestra qué entrenamiento tocaba y si el alumno lo cumplió, y desde donde puede tocar un ejercicio para ver su historial completo en una vista legible.

**Architecture:** Tres piezas: (1) helpers puros de fechas/semana y de agregación de historial, con tests unitarios; (2) una página nueva de historial por ejercicio, que resuelve la *continuidad* del ejercicio a través de semanas duplicadas; (3) una página de calendario mensual que cruza `plan_weeks` + `training_days` + `workout_logs` + `cardio_logs` contra la grilla del mes. Todo son Server Components de Next.js que leen vía Supabase con RLS del coach — sin endpoints nuevos ni cambios de base de datos.

**Tech Stack:** Next.js 15 (App Router, Server Components), TypeScript, Supabase (`@supabase/ssr`), Vitest (nuevo, solo para lógica pura), CSS existente en `globals.css`.

## Global Constraints

- **Solo web.** No se toca `trainer-app/` en este plan. No se necesita build de EAS ni revisión de Apple.
- **Sin migraciones de base de datos.** Todo se resuelve con las tablas existentes: `workout_plans`, `plan_weeks`, `training_days`, `exercises`, `exercise_series`, `workout_logs`, `cardio_logs`.
- **Solo lectura.** El calendario no edita el plan. Editar se sigue haciendo en "Gestión de semanas" (`/clients/[id]` → `WeekManager`).
- **Un alumno a la vez.** Se entra siempre desde la ficha de un cliente; nunca una agenda global del coach.
- **Autorización obligatoria en cada página nueva:** copiar el patrón exacto de `web/src/app/clients/[id]/week/page.tsx` — `getUser()` → `redirect('/login')` si no hay sesión → verificar `users.role === 'coach'` → verificar que `client.coach_id === user.id`, y `notFound()` si no. Sin esto un coach podría leer alumnos de otro coach.
- **Epoch de semanas:** `TRAINING_EPOCH = 2026-06-15T00:00:00` (un lunes), definido en `web/src/lib/weeks.ts`. Debe seguir coincidiendo exacto con `trainer-app/src/lib/weeks.ts`; si divergen, el coach ve una semana distinta a la del alumno.
- **Idioma:** toda la UI en español de Chile, consistente con el resto del panel (etiquetas en mayúsculas con `letter-spacing`, clase `label`, `muted`, `display`).
- **Estilos:** reutilizar las clases existentes de `globals.css` (`container`, `editor-day`, `btn`, `btn-ghost`, `label`, `muted`, `display`, `accent`) y variables CSS (`var(--accent)`, `var(--border)`, `var(--surface)`, `var(--text)`, `var(--text-secondary)`, `var(--font-mono)`). No introducir un framework de CSS nuevo.
- **Commits:** uno por tarea, en español, siguiendo el estilo del repo (`feat:` / `fix:` / `test:`), sin firma de Claude salvo que el repo ya la use en ese archivo.
- **Rama:** trabajar en `feat/calendario-coach`. **NUNCA commitear ni pushear a `sandbox`** — `sandbox` despliega automáticamente a producción (elitefitapp.com), donde hay coaches beta usando la app en este momento. El merge a `sandbox` lo hace el coordinador al final, una sola vez.
- **Paridad web ↔ app (requisito verificable):** el coach y el alumno tienen que ver **exactamente la misma información**. Cualquier fórmula o regla de cálculo que la web reimplemente debe dar resultados idénticos a la de `trainer-app/` para las mismas entradas. Concretamente, `score()` y `oneRepMax()` en `web/src/lib/exerciseHistory.ts` deben ser un espejo fiel de `trainer-app/src/lib/progress.ts` (incluidos el caso especial `reps === 1` y el redondeo a 1 decimal), y sus tests deben afirmar los mismos valores que `trainer-app/src/lib/__tests__/progress.test.ts`. Se acepta a propósito la duplicación de esas funciones: `web/` y `trainer-app/` son dos proyectos npm separados sin paquete compartido, y unificarlos exigiría convertir el repo en un monorepo. La duplicación es una decisión tomada, **no** un hallazgo de revisión; lo que sí es un defecto es que los valores diverjan.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `web/package.json` | agregar `vitest` + script `test` (Tarea 1) |
| `web/vitest.config.ts` | configuración mínima de Vitest (Tarea 1) |
| `web/src/lib/weeks.ts` | **modificar**: agregar `weekNumberForDate()` y `monthGrid()` |
| `web/src/lib/__tests__/weeks.test.ts` | **crear**: tests de los helpers de fecha |
| `web/src/lib/exerciseHistory.ts` | **crear**: lógica pura de agregación del historial de un ejercicio |
| `web/src/lib/__tests__/exerciseHistory.test.ts` | **crear**: tests de esa agregación |
| `web/src/app/clients/[id]/exercise/[exerciseId]/page.tsx` | **crear**: vista de historial de un ejercicio |
| `web/src/app/clients/[id]/week/page.tsx` | **modificar**: convertir nombres de ejercicio en enlaces al historial |
| `web/src/app/clients/[id]/calendar/page.tsx` | **crear**: calendario mensual del alumno |
| `web/src/app/clients/[id]/page.tsx` | **modificar**: enlace "CALENDARIO" en el header |
| `web/src/app/clients/[id]/progress/page.tsx` | **modificar**: enlace "CALENDARIO" en el header |

Los helpers puros viven separados de las páginas a propósito: son la única parte con lógica no trivial (aritmética de semanas, agrupación de logs) y es lo único que se puede testear rápido sin levantar Next ni Supabase.

---

### Task 1: Infraestructura de tests + helpers de fecha

La web no tiene ningún test hoy. Esta tarea instala Vitest y entrega las dos funciones de fecha que el calendario necesita.

**Files:**
- Modify: `web/package.json` (sección `scripts` y `devDependencies`)
- Create: `web/vitest.config.ts`
- Modify: `web/src/lib/weeks.ts`
- Test: `web/src/lib/__tests__/weeks.test.ts`

**Interfaces:**
- Consumes: `TRAINING_EPOCH` (constante privada ya existente en `web/src/lib/weeks.ts`)
- Produces:
  - `weekNumberForDate(date: Date): number` — número de semana del programa al que pertenece una fecha (mínimo 1)
  - `monthGrid(year: number, month: number): Date[][]` — filas de 7 días (lunes→domingo) que cubren el mes; `month` es 0-indexado como en `Date`

- [ ] **Step 1: Instalar Vitest**

```bash
cd web
npm install --save-dev vitest@^2.1.8
```

- [ ] **Step 2: Crear la configuración de Vitest**

Crear `web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

// Solo lógica pura (lib/): los Server Components se verifican en el navegador,
// no acá — montarlos requeriría levantar Next y Supabase.
export default defineConfig({
  test: {
    include: ['src/lib/__tests__/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 3: Agregar el script de test**

En `web/package.json`, dentro de `"scripts"`, agregar la línea `"test": "vitest run"` después de `"lint"`:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run"
  },
```

- [ ] **Step 4: Escribir los tests que fallan**

Crear `web/src/lib/__tests__/weeks.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { weekNumberForDate, monthGrid } from '../weeks';

// El epoch del programa es el lunes 15 de junio de 2026 (semana 1).
describe('weekNumberForDate', () => {
  it('el propio día del epoch es la semana 1', () => {
    expect(weekNumberForDate(new Date('2026-06-15T10:00:00'))).toBe(1);
  });

  it('el domingo siguiente sigue siendo la semana 1', () => {
    expect(weekNumberForDate(new Date('2026-06-21T23:00:00'))).toBe(1);
  });

  it('el lunes siguiente ya es la semana 2', () => {
    expect(weekNumberForDate(new Date('2026-06-22T00:30:00'))).toBe(2);
  });

  it('el 12 de agosto de 2026 es la semana 9', () => {
    expect(weekNumberForDate(new Date('2026-08-12T10:00:00'))).toBe(9);
  });

  it('nunca devuelve menos de 1 para fechas anteriores al epoch', () => {
    expect(weekNumberForDate(new Date('2026-01-01T10:00:00'))).toBe(1);
  });
});

describe('monthGrid', () => {
  it('agosto 2026 ocupa 6 filas de 7 días', () => {
    const grid = monthGrid(2026, 7);
    expect(grid).toHaveLength(6);
    grid.forEach((row) => expect(row).toHaveLength(7));
  });

  it('empieza el lunes anterior al día 1 del mes', () => {
    // el 1 de agosto de 2026 es sábado -> la grilla parte el lunes 27 de julio
    const grid = monthGrid(2026, 7);
    expect(grid[0][0].toDateString()).toBe('Mon Jul 27 2026');
  });

  it('cubre hasta el último día del mes', () => {
    const grid = monthGrid(2026, 7);
    const ultimo = grid[grid.length - 1][6];
    expect(ultimo.getTime()).toBeGreaterThanOrEqual(new Date(2026, 7, 31).getTime());
  });

  it('todas las filas empiezan en lunes', () => {
    monthGrid(2026, 7).forEach((row) => expect(row[0].getDay()).toBe(1));
  });
});
```

- [ ] **Step 5: Correr los tests para verificar que fallan**

```bash
cd web && npm test
```

Esperado: FALLA con `weekNumberForDate is not a function` / `monthGrid is not a function` (o error de importación).

- [ ] **Step 6: Implementar los helpers**

En `web/src/lib/weeks.ts`, agregar al final del archivo:

```ts
/** A qué semana del programa pertenece una fecha (mínimo 1). */
export function weekNumberForDate(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = Math.floor((d.getTime() - TRAINING_EPOCH.getTime()) / (7 * 86400000));
  return Math.max(1, diff + 1);
}

/**
 * Filas de 7 días (lunes→domingo) que cubren el mes completo. `month` es
 * 0-indexado igual que en Date. Incluye días del mes anterior/siguiente
 * para completar la primera y la última fila.
 */
export function monthGrid(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7)); // retrocede al lunes
  const last = new Date(year, month + 1, 0);

  const rows: Date[][] = [];
  const cursor = new Date(start);
  while (cursor <= last) {
    const row: Date[] = [];
    for (let i = 0; i < 7; i++) {
      row.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    rows.push(row);
  }
  return rows;
}
```

- [ ] **Step 7: Correr los tests para verificar que pasan**

```bash
cd web && npm test
```

Esperado: PASA, 9 tests.

- [ ] **Step 8: Verificar que el proyecto sigue compilando**

```bash
cd web && npx tsc --noEmit -p .
```

Esperado: sin salida (código de salida 0).

- [ ] **Step 9: Commit**

```bash
git add web/package.json web/package-lock.json web/vitest.config.ts web/src/lib/weeks.ts web/src/lib/__tests__/weeks.test.ts
git commit -m "test: instalar vitest en la web + helpers de calendario (semana por fecha, grilla mensual)"
```

---

### Task 2: Lógica del historial de un ejercicio

Marcelo reportó que el historial de ejercicios "no tiene una vista amigable". En la web **no existe ninguna**: hay que construirla. Esta tarea entrega solo la lógica pura; la página viene en la Tarea 3.

El problema no trivial: desde que existe "Gestión de semanas", duplicar una semana crea **filas nuevas** de `exercises` (mismo ejercicio, id distinto). Agrupar por `exercises.id` partiría el historial en pedazos. Se agrupa por *continuidad*: `library_id` si existe, si no el nombre normalizado. Es la misma decisión que ya se tomó en `trainer-app/src/screens/client/ProgressScreen.tsx` (ver `contKey` ahí).

**Files:**
- Create: `web/src/lib/exerciseHistory.ts`
- Test: `web/src/lib/__tests__/exerciseHistory.test.ts`

**Interfaces:**
- Consumes: nada de tareas anteriores (es un módulo independiente)
- Produces:
  - `continuityKey(ex: { library_id?: string | null; name: string }): string`
  - `score(weight: number, reps: number): number`
  - `oneRepMax(weight: number, reps: number): number | null`
  - `groupHistoryByWeek(logs: LogRow[], seriesNumber: Record<string, number>): HistoryWeek[]`
  - `personalRecord(weeks: HistoryWeek[]): PR | null`
  - tipos exportados `LogRow`, `HistorySet`, `HistoryWeek`, `PR`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `web/src/lib/__tests__/exerciseHistory.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  continuityKey, score, oneRepMax, groupHistoryByWeek, personalRecord,
  type LogRow,
} from '../exerciseHistory';

describe('continuityKey', () => {
  it('usa library_id cuando existe', () => {
    expect(continuityKey({ library_id: 'lib-1', name: 'Press banca' })).toBe('lib-1');
  });

  it('cae al nombre normalizado cuando no hay library_id', () => {
    expect(continuityKey({ library_id: null, name: '  Press Banca  ' })).toBe('press banca');
  });

  it('dos filas del mismo ejercicio en semanas distintas comparten clave', () => {
    const semana1 = { library_id: 'lib-1', name: 'Press banca' };
    const semana2 = { library_id: 'lib-1', name: 'Press banca' };
    expect(continuityKey(semana1)).toBe(continuityKey(semana2));
  });
});

describe('score / oneRepMax', () => {
  it('más reps con el mismo peso puntúa más alto', () => {
    expect(score(100, 10)).toBeGreaterThan(score(100, 8));
  });

  it('1RM con 1 rep es el propio peso, no la fórmula', () => {
    expect(oneRepMax(100, 1)).toBe(100);
  });

  it('1RM de 80x8 ≈ 101.3 (Epley, redondeado a 1 decimal)', () => {
    expect(oneRepMax(80, 8)).toBeCloseTo(101.3, 1);
  });

  it('devuelve null con datos inválidos', () => {
    expect(oneRepMax(0, 5)).toBeNull();
    expect(oneRepMax(80, 0)).toBeNull();
  });
});

describe('groupHistoryByWeek', () => {
  const seriesNumber = { s1: 1, s2: 2, s3: 3 };
  const log = (series_id: string, week_number: number, weight: number, reps: number, logged_at: string | null = null): LogRow =>
    ({ series_id, week_number, weight, reps, rir: null, logged_at });

  it('agrupa por semana y ordena de la más reciente a la más antigua', () => {
    const out = groupHistoryByWeek(
      [log('s1', 8, 60, 10), log('s1', 9, 65, 10)],
      seriesNumber,
    );
    expect(out.map((w) => w.week)).toEqual([9, 8]);
  });

  it('ordena las series dentro de cada semana por número de serie', () => {
    const out = groupHistoryByWeek(
      [log('s3', 9, 65, 8), log('s1', 9, 60, 10), log('s2', 9, 62.5, 9)],
      seriesNumber,
    );
    expect(out[0].sets.map((s) => s.series_number)).toEqual([1, 2, 3]);
  });

  it('calcula el volumen de la semana como suma de peso × reps', () => {
    const out = groupHistoryByWeek([log('s1', 9, 60, 10), log('s2', 9, 50, 10)], seriesNumber);
    expect(out[0].volume).toBe(1100);
  });

  it('toma como fecha de la semana la más temprana registrada', () => {
    const out = groupHistoryByWeek(
      [log('s2', 9, 60, 10, '2026-08-13T10:00:00Z'), log('s1', 9, 60, 10, '2026-08-12T10:00:00Z')],
      seriesNumber,
    );
    expect(out[0].date).toBe('2026-08-12T10:00:00Z');
  });

  it('ignora logs de series desconocidas', () => {
    const out = groupHistoryByWeek([log('fantasma', 9, 60, 10)], seriesNumber);
    expect(out).toEqual([]);
  });

  it('devuelve lista vacía sin logs', () => {
    expect(groupHistoryByWeek([], seriesNumber)).toEqual([]);
  });
});

describe('personalRecord', () => {
  const seriesNumber = { s1: 1 };
  const log = (week_number: number, weight: number, reps: number): LogRow =>
    ({ series_id: 's1', week_number, weight, reps, rir: null, logged_at: null });

  it('elige la serie con mejor puntaje estimado, no solo el peso más alto', () => {
    // 100x5 (score 116.7) supera a 105x2 (score 112)
    const weeks = groupHistoryByWeek([log(8, 105, 2), log(9, 100, 5)], seriesNumber);
    expect(personalRecord(weeks)).toEqual({ weight: 100, reps: 5, week: 9 });
  });

  it('devuelve null sin historial', () => {
    expect(personalRecord([])).toBeNull();
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

```bash
cd web && npm test
```

Esperado: FALLA — no existe el módulo `../exerciseHistory`.

- [ ] **Step 3: Implementar el módulo**

Crear `web/src/lib/exerciseHistory.ts`:

```ts
// Historial de UN ejercicio a lo largo de las semanas.
//
// Ojo con la continuidad: desde "Gestión de semanas", duplicar una semana crea
// filas nuevas en `exercises` (mismo ejercicio, id distinto). Agrupar por id
// partiría el historial en pedazos, así que se agrupa por library_id (o por
// nombre normalizado si el ejercicio no vino de la biblioteca). Misma decisión
// que en trainer-app/src/screens/client/ProgressScreen.tsx.

export interface LogRow {
  series_id: string;
  week_number: number;
  weight: number;
  reps: number;
  rir: number | null;
  logged_at: string | null;
}

export interface HistorySet {
  series_number: number;
  weight: number;
  reps: number;
  rir: number | null;
}

export interface HistoryWeek {
  week: number;
  date: string | null;
  sets: HistorySet[];
  volume: number;
}

export interface PR {
  weight: number;
  reps: number;
  week: number;
}

export function continuityKey(ex: { library_id?: string | null; name: string }): string {
  return ex.library_id ?? ex.name.trim().toLowerCase();
}

/** Fuerza estimada (Epley): captura mejoras de peso Y de reps en un solo número. */
export function score(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

/**
 * 1RM estimado, redondeado a 1 decimal. reps=1 devuelve el peso tal cual
 * (la fórmula de Epley daría 103.3 para 100x1, que sería absurdo mostrarle
 * al coach). Espejo exacto de oneRepMax en trainer-app/src/lib/progress.ts.
 */
export function oneRepMax(weight: number, reps: number): number | null {
  if (!weight || !reps || reps < 1) return null;
  if (reps === 1) return weight;
  return Math.round(score(weight, reps) * 10) / 10;
}

/** Agrupa los logs por semana, de la más reciente a la más antigua. */
export function groupHistoryByWeek(
  logs: LogRow[],
  seriesNumber: Record<string, number>,
): HistoryWeek[] {
  const byWeek = new Map<number, HistoryWeek>();

  logs.forEach((l) => {
    const num = seriesNumber[l.series_id];
    if (num == null) return; // log de una serie que ya no existe en el plan

    const entry = byWeek.get(l.week_number) ?? { week: l.week_number, date: null, sets: [], volume: 0 };
    entry.sets.push({ series_number: num, weight: l.weight, reps: l.reps, rir: l.rir });
    entry.volume += l.weight * l.reps;
    if (l.logged_at && (!entry.date || l.logged_at < entry.date)) entry.date = l.logged_at;
    byWeek.set(l.week_number, entry);
  });

  const weeks = Array.from(byWeek.values());
  weeks.forEach((w) => w.sets.sort((a, b) => a.series_number - b.series_number));
  return weeks.sort((a, b) => b.week - a.week);
}

/** La mejor serie de todo el historial, por fuerza estimada (no por peso bruto). */
export function personalRecord(weeks: HistoryWeek[]): PR | null {
  const todas: PR[] = weeks.flatMap((w) =>
    w.sets.map((s) => ({ weight: s.weight, reps: s.reps, week: w.week })));
  if (todas.length === 0) return null;
  return todas.reduce((best, cur) =>
    score(cur.weight, cur.reps) > score(best.weight, best.reps) ? cur : best);
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

```bash
cd web && npm test
```

Esperado: PASA, 24 tests en total (9 de la Tarea 1 + 15 de esta).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/exerciseHistory.ts web/src/lib/__tests__/exerciseHistory.test.ts
git commit -m "feat(web): lógica de historial por ejercicio con continuidad entre semanas duplicadas"
```

---

### Task 3: Página de historial de un ejercicio

La vista que Marcelo pidió: tocar un ejercicio y ver su historial completo, legible.

**Files:**
- Create: `web/src/app/clients/[id]/exercise/[exerciseId]/page.tsx`

**Interfaces:**
- Consumes: `continuityKey`, `groupHistoryByWeek`, `personalRecord`, `oneRepMax`, tipos `LogRow`/`HistoryWeek` (Tarea 2); `formatShortDate` (ya existe en `web/src/lib/weeks.ts`); `TrendChart` (ya existe en `web/src/components/TrendChart.tsx`, props `{ data: {label,value}[]; height?: number; unit?: string }`)
- Produces: ruta `/clients/[id]/exercise/[exerciseId]` — a esta ruta enlazan la Tarea 4 y la Tarea 5

- [ ] **Step 1: Crear la página**

Crear `web/src/app/clients/[id]/exercise/[exerciseId]/page.tsx`:

```tsx
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import Logo from '@/components/Logo';
import TrendChart from '@/components/TrendChart';
import type { AppUser } from '@/lib/types';
import { formatShortDate } from '@/lib/weeks';
import {
  continuityKey, groupHistoryByWeek, personalRecord, oneRepMax, type LogRow,
} from '@/lib/exerciseHistory';

export const dynamic = 'force-dynamic';

// Historial completo de UN ejercicio de UN alumno, a través de todas las
// semanas en que apareció (incluidas las semanas duplicadas, que crean filas
// nuevas de `exercises` — ver lib/exerciseHistory.ts).

export default async function ExerciseHistoryPage({
  params,
}: { params: Promise<{ id: string; exerciseId: string }> }) {
  const { id, exerciseId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== 'coach') redirect('/login');

  const { data: client } = await supabase
    .from('users').select('id, name, coach_id').eq('id', id).maybeSingle();
  if (!client || (client as AppUser).coach_id !== user.id) notFound();

  // el ejercicio de referencia (el que se tocó)
  const { data: ref } = await supabase
    .from('exercises')
    .select('id, name, name_en, unit, library_id, muscle_group, reps_objective')
    .eq('id', exerciseId)
    .maybeSingle();
  if (!ref) notFound();

  // todas las filas "hermanas" de ese ejercicio dentro del plan de ESTE alumno
  const { data: plan } = await supabase
    .from('workout_plans').select('id').eq('client_id', id).maybeSingle();
  if (!plan) notFound();

  const { data: allDays } = await supabase
    .from('training_days')
    .select('id, exercises ( id, name, library_id, exercise_series ( id, series_number ) )')
    .eq('plan_id', plan.id);

  const key = continuityKey(ref);
  const siblings = (allDays ?? [])
    .flatMap((d: any) => d.exercises ?? [])
    .filter((e: any) => continuityKey(e) === key);

  // si el ejercicio de referencia no pertenece al plan de este alumno, el
  // coach no tiene por qué verlo acá
  if (!siblings.some((e: any) => e.id === ref.id)) notFound();

  const seriesNumber: Record<string, number> = {};
  siblings.forEach((e: any) =>
    (e.exercise_series ?? []).forEach((s: any) => { seriesNumber[s.id] = s.series_number; }));
  const seriesIds = Object.keys(seriesNumber);

  const { data: logs } = seriesIds.length
    ? await supabase
        .from('workout_logs')
        .select('series_id, week_number, weight, reps, rir, logged_at')
        .in('series_id', seriesIds)
    : { data: null };

  const history = groupHistoryByWeek((logs ?? []) as LogRow[], seriesNumber);
  const pr = personalRecord(history);
  const prE1rm = pr ? oneRepMax(pr.weight, pr.reps) : null;

  // el gráfico va de la semana más antigua a la más reciente
  const chart = history.slice().reverse().map((w) => ({
    label: `S${w.week}`,
    value: Math.round(w.volume),
  }));

  return (
    <>
      <header className="app-header">
        <div className="container inner">
          <Link href="/dashboard" className="brand"><Logo /></Link>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href={`/clients/${id}/calendar`} className="btn btn-ghost" style={{ padding: '10px 18px' }}>
              CALENDARIO
            </Link>
            <Link href={`/clients/${id}/week`} className="btn btn-ghost" style={{ padding: '10px 18px' }}>
              ← SEMANA A SEMANA
            </Link>
          </div>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 34, paddingBottom: 60, maxWidth: 860 }}>
        <span className="label accent">Historial · {(client as AppUser).name}</span>
        <h1 className="display" style={{ fontSize: 40 }}>{ref.name}</h1>
        <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>
          {[ref.name_en, ref.muscle_group, ref.reps_objective ? `objetivo ${ref.reps_objective} reps` : null]
            .filter(Boolean).join(' · ')}
        </p>

        {history.length === 0 ? (
          <div className="editor-day" style={{ marginTop: 24, textAlign: 'center', padding: 40 }}>
            <p className="muted">
              Este alumno todavía no registra este ejercicio. Su progreso aparecerá acá semana a semana.
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
              {[
                { v: pr ? `${pr.weight}${ref.unit} × ${pr.reps}` : '—', l: `MEJOR MARCA${pr ? ` · S${pr.week}` : ''}` },
                { v: prE1rm ? `${Math.round(prE1rm)}${ref.unit}` : '—', l: '1RM ESTIMADO' },
                { v: String(history.length), l: 'SEMANAS REGISTRADAS' },
              ].map((s) => (
                <div key={s.l} className="editor-day" style={{ flex: 1, minWidth: 160, textAlign: 'center', padding: 16 }}>
                  <div className="display" style={{ fontSize: 24, color: 'var(--accent)' }}>{s.v}</div>
                  <div className="label muted" style={{ fontSize: 9, letterSpacing: 1 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {chart.length >= 2 && (
              <div className="editor-day" style={{ marginTop: 16 }}>
                <h3 style={{ marginBottom: 4 }}>Carga total por semana</h3>
                <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
                  Suma de peso × repeticiones de todas las series de ese ejercicio.
                </p>
                <TrendChart data={chart} unit={` ${ref.unit}`} />
              </div>
            )}

            <div className="editor-day" style={{ marginTop: 16 }}>
              <h3 style={{ marginBottom: 12 }}>Semana a semana</h3>
              {history.map((w) => (
                <div key={w.week} style={{ borderTop: '1px solid var(--border)', padding: '12px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 13 }}>SEMANA {w.week}</strong>
                    {w.date && <span className="muted" style={{ fontSize: 12 }}>{formatShortDate(w.date)}</span>}
                    <span className="muted" style={{ fontSize: 12, marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>
                      {Math.round(w.volume).toLocaleString('es-CL')} {ref.unit} totales
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {w.sets.map((s, i) => (
                      <span key={i} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 6, padding: '4px 9px',
                      }}>
                        <b style={{ fontSize: 10, color: 'var(--accent)' }}>S{s.series_number}</b>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                          {s.weight}{ref.unit} × {s.reps}{s.rir != null ? ` · RIR ${s.rir}` : ''}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
```

- [ ] **Step 2: Verificar que compila**

```bash
cd web && npx tsc --noEmit -p .
```

Esperado: sin salida.

- [ ] **Step 3: Verificar que la ruta se registra en el build**

```bash
cd web && npx next build 2>&1 | grep "exercise"
```

Esperado: una línea que incluya `/clients/[id]/exercise/[exerciseId]`.

- [ ] **Step 4: Commit**

```bash
git add "web/src/app/clients/[id]/exercise/[exerciseId]/page.tsx"
git commit -m "feat(web): vista de historial por ejercicio (mejor marca, 1RM estimado, carga por semana)"
```

---

### Task 4: Enlazar los ejercicios de la vista semanal al historial

Marcelo dijo: "al seleccionar un ejercicio de un día particular de un cliente, lo lógico es que se despliegue el historial de ese ejercicio". Hoy los nombres de ejercicio en la vista semanal son texto muerto.

**Files:**
- Modify: `web/src/app/clients/[id]/week/page.tsx`

**Interfaces:**
- Consumes: la ruta `/clients/[id]/exercise/[exerciseId]` (Tarea 3)
- Produces: nada nuevo

- [ ] **Step 1: Convertir el nombre del ejercicio en enlace**

En `web/src/app/clients/[id]/week/page.tsx`, buscar este bloque dentro del `day.exercises.map(...)`:

```tsx
                        <div style={{ fontSize: 13, fontWeight: sets ? 700 : 400, color: sets ? 'var(--text)' : 'var(--text-secondary)' }}>
                          {ex.name}
                        </div>
```

Reemplazarlo por:

```tsx
                        <Link
                          href={`/clients/${id}/exercise/${ex.id}`}
                          style={{
                            fontSize: 13,
                            fontWeight: sets ? 700 : 400,
                            color: sets ? 'var(--text)' : 'var(--text-secondary)',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                          title={`Ver historial de ${ex.name}`}
                        >
                          {ex.name}
                          <span className="muted" style={{ fontSize: 10 }}>›</span>
                        </Link>
```

`Link` ya está importado al inicio de ese archivo — no hay que agregar el import.

- [ ] **Step 2: Verificar que compila**

```bash
cd web && npx tsc --noEmit -p .
```

Esperado: sin salida.

- [ ] **Step 3: Commit**

```bash
git add "web/src/app/clients/[id]/week/page.tsx"
git commit -m "feat(web): tocar un ejercicio en la vista semanal abre su historial"
```

---

### Task 5: Calendario mensual del alumno

**Files:**
- Create: `web/src/app/clients/[id]/calendar/page.tsx`

**Interfaces:**
- Consumes: `weekNumberForDate`, `monthGrid` (Tarea 1); `resolveActiveWeek` y el tipo `PlanWeek` (ya existen en `web/src/lib/planWeeks.ts`); la ruta de historial de la Tarea 3
- Produces: ruta `/clients/[id]/calendar` — a ella enlazan la Tarea 6 y el header de la Tarea 3

- [ ] **Step 1: Crear la página**

Crear `web/src/app/clients/[id]/calendar/page.tsx`:

```tsx
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import Logo from '@/components/Logo';
import type { AppUser } from '@/lib/types';
import { resolveActiveWeek, type PlanWeek } from '@/lib/planWeeks';
import { weekNumberForDate, monthGrid } from '@/lib/weeks';

export const dynamic = 'force-dynamic';

// Calendario mensual de UN alumno: qué entrenamiento tocaba cada día según el
// plan, y si lo cumplió. Solo lectura — editar se sigue haciendo en
// "Gestión de semanas" dentro del plan.

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const CABECERA = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

export default async function ClientCalendarPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ m?: string }> }) {
  const { id } = await params;
  const { m } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== 'coach') redirect('/login');

  const { data: client } = await supabase
    .from('users').select('id, name, coach_id').eq('id', id).maybeSingle();
  if (!client || (client as AppUser).coach_id !== user.id) notFound();

  // mes a mostrar: ?m=YYYY-MM, por defecto el mes actual
  const hoy = new Date();
  const match = /^(\d{4})-(\d{2})$/.exec(m ?? '');
  const year = match ? Number(match[1]) : hoy.getFullYear();
  const month = match ? Number(match[2]) - 1 : hoy.getMonth();
  const grid = monthGrid(year, month);

  const prevDate = new Date(year, month - 1, 1);
  const nextDate = new Date(year, month + 1, 1);
  const asParam = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  const { data: plan } = await supabase
    .from('workout_plans').select('id').eq('client_id', id).maybeSingle();

  const { data: weeksData } = plan
    ? await supabase.from('plan_weeks').select('*').eq('plan_id', plan.id).eq('archived', false)
    : { data: null };
  const planWeeks = (weeksData ?? []) as PlanWeek[];

  const { data: daysData } = plan
    ? await supabase
        .from('training_days')
        .select(`
          id, name, week_day, archived, plan_week_id,
          exercises ( id, name, archived, exercise_series ( id ) )
        `)
        .eq('plan_id', plan.id)
    : { data: null };

  const trainingDays = (daysData ?? [])
    .filter((d: any) => !d.archived && !d.name.toLowerCase().includes('libre'))
    .map((d: any) => ({
      ...d,
      exercises: (d.exercises ?? []).filter((e: any) => !e.archived),
    }));

  // logs de todas las semanas que toca este mes, en una sola consulta
  const weekNumbers = Array.from(new Set(grid.flat().map((d) => weekNumberForDate(d))));
  const allSeriesIds = trainingDays.flatMap((d: any) =>
    d.exercises.flatMap((e: any) => (e.exercise_series ?? []).map((s: any) => s.id)));

  const { data: logs } = allSeriesIds.length
    ? await supabase
        .from('workout_logs')
        .select('series_id, week_number')
        .in('series_id', allSeriesIds)
        .in('week_number', weekNumbers)
    : { data: null };

  // series_id -> exercise_id, para contar ejercicios completados (no series)
  const exBySeries = new Map<string, string>();
  trainingDays.forEach((d: any) => d.exercises.forEach((e: any) =>
    (e.exercise_series ?? []).forEach((s: any) => exBySeries.set(s.id, e.id))));

  // "semana N" -> set de exercise_id con al menos un registro
  const doneByWeek = new Map<number, Set<string>>();
  (logs ?? []).forEach((l: any) => {
    const exId = exBySeries.get(l.series_id);
    if (!exId) return;
    const set = doneByWeek.get(l.week_number) ?? new Set<string>();
    set.add(exId);
    doneByWeek.set(l.week_number, set);
  });

  // cardio del rango visible
  const desde = grid[0][0];
  const hasta = new Date(grid[grid.length - 1][6]);
  hasta.setDate(hasta.getDate() + 1);
  const { data: cardio } = await supabase
    .from('cardio_logs')
    .select('id, type, duration_minutes, logged_at')
    .eq('user_id', id)
    .gte('logged_at', desde.toISOString())
    .lt('logged_at', hasta.toISOString());

  const cardioByDay = new Map<string, number>();
  (cardio ?? []).forEach((c: any) => {
    const k = new Date(c.logged_at).toDateString();
    cardioByDay.set(k, (cardioByDay.get(k) ?? 0) + c.duration_minutes);
  });

  const esHoy = (d: Date) => d.toDateString() === hoy.toDateString();
  const esDelMes = (d: Date) => d.getMonth() === month;

  return (
    <>
      <header className="app-header">
        <div className="container inner">
          <Link href="/dashboard" className="brand"><Logo /></Link>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href={`/clients/${id}/week`} className="btn btn-ghost" style={{ padding: '10px 18px' }}>
              SEMANA A SEMANA
            </Link>
            <Link href={`/clients/${id}`} className="btn btn-ghost" style={{ padding: '10px 18px' }}>
              ← PLAN
            </Link>
          </div>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 34, paddingBottom: 60 }}>
        <span className="label accent">Calendario</span>
        <h1 className="display" style={{ fontSize: 40 }}>{(client as AppUser).name}</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <Link href={`/clients/${id}/calendar?m=${asParam(prevDate)}`} className="btn btn-ghost" style={{ padding: '8px 14px' }}>
            ← {MESES[prevDate.getMonth()].toUpperCase()}
          </Link>
          <strong style={{ fontSize: 14 }}>{MESES[month].toUpperCase()} {year}</strong>
          <Link href={`/clients/${id}/calendar?m=${asParam(nextDate)}`} className="btn btn-ghost" style={{ padding: '8px 14px' }}>
            {MESES[nextDate.getMonth()].toUpperCase()} →
          </Link>
          <Link href={`/clients/${id}/calendar`} className="btn btn-ghost" style={{ padding: '8px 14px' }}>HOY</Link>
        </div>

        {!plan || trainingDays.length === 0 ? (
          <p className="muted" style={{ marginTop: 30 }}>
            Este alumno todavía no tiene días de entrenamiento planificados.
          </p>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: 20 }}>
            <div style={{ minWidth: 720 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
                {CABECERA.map((c) => (
                  <div key={c} className="label muted" style={{ fontSize: 9, letterSpacing: 1, textAlign: 'center' }}>
                    {c}
                  </div>
                ))}
              </div>

              {grid.map((row, ri) => (
                <div key={ri} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
                  {row.map((date) => {
                    const weekNum = weekNumberForDate(date);
                    const activeWeek = resolveActiveWeek(planWeeks, weekNum);
                    const delDia = activeWeek
                      ? trainingDays.filter((d: any) =>
                          d.plan_week_id === activeWeek.id && d.week_day === date.getDay())
                      : [];
                    const done = doneByWeek.get(weekNum) ?? new Set<string>();
                    const cardioMin = cardioByDay.get(date.toDateString()) ?? 0;
                    const futuro = date.getTime() > hoy.getTime() && !esHoy(date);

                    return (
                      <div
                        key={date.toISOString()}
                        style={{
                          minHeight: 96,
                          borderRadius: 8,
                          border: `1px solid ${esHoy(date) ? 'var(--accent)' : 'var(--border)'}`,
                          background: esDelMes(date) ? 'var(--surface)' : 'transparent',
                          opacity: esDelMes(date) ? 1 : 0.4,
                          padding: 6,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{
                            fontSize: 12,
                            fontWeight: esHoy(date) ? 900 : 600,
                            color: esHoy(date) ? 'var(--accent)' : 'var(--text-secondary)',
                          }}>
                            {date.getDate()}
                          </span>
                          {activeWeek && esDelMes(date) && (
                            <span className="muted" style={{ fontSize: 8.5 }}>S{weekNum}</span>
                          )}
                        </div>

                        {delDia.map((d: any) => {
                          const hechos = d.exercises.filter((e: any) => done.has(e.id)).length;
                          const total = d.exercises.length;
                          const completo = total > 0 && hechos >= total;
                          const parcial = hechos > 0 && !completo;
                          const perdido = hechos === 0 && !futuro;
                          return (
                            <Link
                              key={d.id}
                              href={`/clients/${id}/week?week=${weekNum}`}
                              title={`${d.name} — ${hechos}/${total} ejercicios`}
                              style={{
                                display: 'block', textDecoration: 'none',
                                borderRadius: 5, padding: '3px 5px',
                                background: completo ? 'var(--accent)' : 'transparent',
                                border: `1px solid ${completo ? 'var(--accent)' : perdido ? 'var(--danger)' : 'var(--border)'}`,
                                color: completo ? 'var(--bg)' : 'var(--text)',
                              }}
                            >
                              <div style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.25 }}>
                                {d.name}
                              </div>
                              <div style={{
                                fontSize: 9,
                                fontFamily: 'var(--font-mono)',
                                opacity: 0.85,
                                color: completo ? 'var(--bg)' : parcial ? 'var(--accent)' : undefined,
                              }}>
                                {futuro && hechos === 0 ? 'pendiente' : `${hechos}/${total}`}
                              </div>
                            </Link>
                          );
                        })}

                        {cardioMin > 0 && (
                          <div style={{ fontSize: 9, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                            ⏱ {cardioMin} min
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }} className="muted">
          <span style={{ fontSize: 11 }}>■ relleno = día completo</span>
          <span style={{ fontSize: 11 }}>□ borde rojo = día planificado que no registró</span>
          <span style={{ fontSize: 11 }}>⏱ = cardio registrado ese día</span>
          <span style={{ fontSize: 11 }}>Toca un día para ver el detalle de esa semana.</span>
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Verificar que compila**

```bash
cd web && npx tsc --noEmit -p .
```

Esperado: sin salida.

- [ ] **Step 3: Verificar que la ruta se registra**

```bash
cd web && npx next build 2>&1 | grep "calendar"
```

Esperado: una línea que incluya `/clients/[id]/calendar`.

- [ ] **Step 4: Commit**

```bash
git add "web/src/app/clients/[id]/calendar/page.tsx"
git commit -m "feat(web): calendario mensual del alumno con cumplimiento por día"
```

---

### Task 6: Navegación y verificación en producción

**Files:**
- Modify: `web/src/app/clients/[id]/page.tsx`
- Modify: `web/src/app/clients/[id]/progress/page.tsx`

**Interfaces:**
- Consumes: rutas de las Tareas 3 y 5
- Produces: nada nuevo

- [ ] **Step 1: Agregar el enlace en la ficha del cliente**

En `web/src/app/clients/[id]/page.tsx`, buscar:

```tsx
            <Link href={`/clients/${id}/week`} className="btn btn-ghost" style={{ padding: '10px 18px' }}>
              SEMANA A SEMANA
            </Link>
```

Insertar **antes** de ese bloque:

```tsx
            <Link href={`/clients/${id}/calendar`} className="btn btn-ghost" style={{ padding: '10px 18px' }}>
              CALENDARIO
            </Link>
```

- [ ] **Step 2: Agregar el enlace en la página de evolución**

En `web/src/app/clients/[id]/progress/page.tsx`, buscar:

```tsx
            <Link href={`/clients/${id}/week`} className="btn btn-ghost" style={{ padding: '10px 18px' }}>
              SEMANA A SEMANA
            </Link>
```

Insertar **antes** de ese bloque:

```tsx
            <Link href={`/clients/${id}/calendar`} className="btn btn-ghost" style={{ padding: '10px 18px' }}>
              CALENDARIO
            </Link>
```

- [ ] **Step 3: Correr toda la verificación local**

```bash
cd web && npm test && npx tsc --noEmit -p . && npx next build
```

Esperado: 24 tests PASAN, sin errores de tipos, build exitoso mostrando las rutas `/clients/[id]/calendar` y `/clients/[id]/exercise/[exerciseId]`.

- [ ] **Step 4: Commit y desplegar**

```bash
git add "web/src/app/clients/[id]/page.tsx" "web/src/app/clients/[id]/progress/page.tsx"
git commit -m "feat(web): enlaces al calendario desde la ficha del cliente y la vista de evolución"
git push origin sandbox
```

Vercel despliega solo al pushear a `sandbox`. Esperar a que el deploy quede en estado `READY` antes del paso siguiente.

- [ ] **Step 5: Verificar en producción con datos reales**

La cuenta demo (`appreview.coach@elitefitapp.com` / `AppleReview2026!`) tiene un alumno con plan pero **sin registros**, así que sirve para ver el estado vacío pero no el de "día completado". Para verificar el camino con datos, insertar registros temporales y borrarlos después:

```bash
cd trainer-app
SK=$(grep SUPABASE_SERVICE_KEY .env.local | cut -d= -f2)
URL=$(grep SUPABASE_URL .env.local | cut -d= -f2)
CLIENT=b504a289-4e03-482d-9a67-5a82317d0656
NOW=$(python3 -c "import datetime;print(datetime.datetime.now(datetime.timezone.utc).isoformat())")
curl -s -X POST "$URL/rest/v1/workout_logs" \
  -H "apikey: $SK" -H "Authorization: Bearer $SK" -H "Content-Type: application/json" -H "Prefer: return=minimal" \
  -d "[
   {\"series_id\":\"f3eaed0e-1dc3-4b81-9bc4-54a8e2c7d007\",\"week_number\":9,\"weight\":60,\"reps\":10,\"rir\":2,\"logged_at\":\"$NOW\",\"logged_by\":\"$CLIENT\"},
   {\"series_id\":\"d9d88dc3-3c2b-4309-b56a-17a7a5eb34ed\",\"week_number\":9,\"weight\":62.5,\"reps\":9,\"rir\":1,\"logged_at\":\"$NOW\",\"logged_by\":\"$CLIENT\"},
   {\"series_id\":\"c7e321e5-f524-4377-bf5d-54b87a2583eb\",\"week_number\":9,\"weight\":65,\"reps\":8,\"rir\":null,\"logged_at\":\"$NOW\",\"logged_by\":\"$CLIENT\"}
  ]" -w "\nHTTP %{http_code}\n"
```

Esperado: `HTTP 201`.

Después, en el navegador (o con Playwright), iniciar sesión como el coach demo y revisar:

1. `https://elitefitapp.com/clients/b504a289-4e03-482d-9a67-5a82317d0656/calendar`
   - El día lunes de la semana 9 muestra "Piernas" con `1/1` y fondo relleno.
   - Los meses anterior/siguiente navegan y el botón HOY vuelve al mes actual.
2. `https://elitefitapp.com/clients/b504a289-4e03-482d-9a67-5a82317d0656/week`
   - El nombre "Sentadilla" ahora es un enlace.
3. Tocar "Sentadilla" → debe abrir el historial mostrando `60kg × 10 · RIR 2`, `62.5kg × 9 · RIR 1`, `65kg × 8`, mejor marca `65kg × 8` y 1 semana registrada.

- [ ] **Step 6: Borrar los datos de prueba**

La cuenta demo la usa Apple para revisar la app — **no puede quedar con datos inventados**.

```bash
cd trainer-app
SK=$(grep SUPABASE_SERVICE_KEY .env.local | cut -d= -f2)
URL=$(grep SUPABASE_URL .env.local | cut -d= -f2)
for S in f3eaed0e-1dc3-4b81-9bc4-54a8e2c7d007 d9d88dc3-3c2b-4309-b56a-17a7a5eb34ed c7e321e5-f524-4377-bf5d-54b87a2583eb; do
  curl -s -X DELETE "$URL/rest/v1/workout_logs?series_id=eq.$S&week_number=eq.9" \
    -H "apikey: $SK" -H "Authorization: Bearer $SK"
done
curl -s "$URL/rest/v1/workout_logs?series_id=in.(f3eaed0e-1dc3-4b81-9bc4-54a8e2c7d007,d9d88dc3-3c2b-4309-b56a-17a7a5eb34ed,c7e321e5-f524-4377-bf5d-54b87a2583eb)&select=id" \
  -H "apikey: $SK" -H "Authorization: Bearer $SK"
```

Esperado: la última consulta devuelve `[]`.

---

## Fuera de alcance (explícito)

- La app móvil. Si el calendario funciona bien en la web, portarlo es un plan aparte (en celular el mes completo no cabe; habría que diseñar una variante de 2 semanas).
- Arrastrar días para moverlos o copiarlos desde el calendario. Se decidió solo lectura.
- Una agenda con todos los alumnos juntos.
- Cambios de base de datos.
