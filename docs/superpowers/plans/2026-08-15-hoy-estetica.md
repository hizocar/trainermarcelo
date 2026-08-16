# Rediseño estético de "Hoy" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la pantalla más usada de la app deje de verse plana: un anillo de progreso domina, el peso de cada ejercicio se lee de un vistazo, y los tres estados (hecho / siguiente / pendiente) se distinguen de verdad.

**Architecture:** Se extraen tres piezas nuevas y pequeñas —constantes de movimiento, el anillo animado, la fila de ejercicio— y `TodayScreen` pasa a componerlas. La pantalla ya tiene 745 líneas; meterle animaciones sin extraer nada la volvería inmanejable. No cambia ningún dato, consulta ni lógica de negocio: es un cambio de presentación.

**Tech Stack:** React Native / Expo SDK 54, React Native 0.81.5, Reanimated 4.1.1 (instalado y hoy sin usar), `react-native-svg` (ya presente, lo usa `MuscleMap`), Jest.

## Global Constraints

- **Rama:** trabajar en `feat/hoy-estetica`. **NUNCA commitear ni pushear a `sandbox`** — despliega automáticamente a producción (elitefitapp.com), donde hay seis coaches beta y sus alumnos usando el producto. El merge lo hace el coordinador al final, una sola vez.
- **Solo se toca `trainer-app/`.** No se modifica `web/`. Sin migraciones de base de datos.
- **No se toca `trainer-app/src/screens/coach/PlanEditorScreen.tsx`** (1.116 líneas, el archivo más frágil del proyecto).
- **Ninguna consulta nueva a la base de datos, ni cambios de lógica de negocio.** `fetchWeek`, `loadNote`, `saveNote` y `saveCardio` se conservan tal cual. La única excepción autorizada está en la Tarea 5: `applyWeek` guarda un dato que `fetchLogs` ya trae y hoy descarta. Cualquier otra necesidad de tocar esas funciones: PARAR y reportarlo.
- **Ninguna función se elimina.** Navegación de semanas, selector de días, registro de cardio y nota al coach siguen existiendo, con menos peso visual.
- **El tema no se modifica.** Se usan los tokens existentes de `trainer-app/src/theme/index.ts`. Si hiciera falta uno nuevo, PARAR y preguntar — el monocromo es una decisión documentada (ver el comentario al inicio de ese archivo).
- **Monocromo estricto en esta pantalla.** El ámbar `colors.warning` está reservado para alertas del coach y **no se usa acá**. Los seis colores de biseries (`GROUP_COLORS`) se eliminan; las biseries pasan a un corchete monocromo.
- **Reanimated 4:** **nunca usar `runOnJS`** — se eliminó en esa versión; usar `scheduleOnRN` de `react-native-worklets`. Antes de escribir animaciones, consultar la skill `react-native-best-practices` de Software Mansion (instalada en `~/.claude/skills/`), en particular `references/animations/`.
- **Accesibilidad:** toda animación respeta `useReducedMotion()` de Reanimated. Con la preferencia activada, los elementos se muestran directamente en su estado final.
- **Idioma:** UI y comentarios en español de Chile.
- **Commits:** uno por tarea, en español (`feat:` / `fix:` / `refactor:`).
- Los **56 tests** existentes de `trainer-app/` deben seguir pasando y `npx tsc --noEmit -p .` quedar limpio en cada tarea.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `trainer-app/src/lib/motion.ts` | **crear** — duraciones, retardos y curvas del sistema de movimiento, en un solo lugar |
| `trainer-app/src/lib/__tests__/motion.test.ts` | **crear** — tests del escalonado |
| `trainer-app/src/lib/progress.ts` | **modificar** — se le agrega `topSetByExercise`, junto al `score` y `bestSet` que ya viven ahí |
| `trainer-app/src/components/common/ProgressRing.tsx` | **crear** — anillo de progreso animado, reutilizable |
| `trainer-app/src/components/client/ExerciseRow.tsx` | **crear** — una fila de ejercicio con sus tres estados |
| `trainer-app/src/screens/client/TodayScreen.tsx` | **modificar** — compone las piezas nuevas; se le quitan estilos de tarjeta y los colores de biserie |

`TodayScreen` ya tiene 745 líneas. Estas extracciones no son un refactor gratuito: el anillo y la fila son las dos piezas con animación, y dejarlas dentro de la pantalla haría imposible razonar sobre ellas o reutilizarlas cuando el lenguaje se propague a otras pantallas.

---

### Task 1: El sistema de movimiento

Constantes compartidas para que las animaciones de esta pantalla —y las futuras— tengan el mismo ritmo, en vez de números mágicos repartidos por los componentes.

**Files:**
- Create: `trainer-app/src/lib/motion.ts`
- Test: `trainer-app/src/lib/__tests__/motion.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `DURATION: { ring: 1100; value: 800; row: 500 }`
  - `DELAY: { value: 150; rowBase: 300; rowStep: 80 }`
  - `EASING_OUT: { damping: number; stiffness: number; mass: number }` — configuración de `withSpring` para la sensación de desaceleración
  - `rowDelay(index: number): number`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `trainer-app/src/lib/__tests__/motion.test.ts`:

```ts
import { DURATION, DELAY, rowDelay } from '../motion';

describe('rowDelay', () => {
  it('la primera fila entra después del retardo base', () => {
    expect(rowDelay(0)).toBe(DELAY.rowBase);
  });

  it('cada fila siguiente se escalona un paso', () => {
    expect(rowDelay(1)).toBe(DELAY.rowBase + DELAY.rowStep);
    expect(rowDelay(2)).toBe(DELAY.rowBase + DELAY.rowStep * 2);
  });

  it('la cascada se corta a partir de la fila 8: una sesión larga no debe tardar segundos en aparecer', () => {
    // 8 filas ya son ~940ms de cascada; más allá se entra sin retardo extra
    expect(rowDelay(8)).toBe(rowDelay(7));
    expect(rowDelay(20)).toBe(rowDelay(7));
  });

  it('un índice negativo no rompe: se trata como la primera fila', () => {
    expect(rowDelay(-1)).toBe(DELAY.rowBase);
  });
});

describe('duraciones', () => {
  it('el anillo dura más que una fila: es el gesto principal', () => {
    expect(DURATION.ring).toBeGreaterThan(DURATION.row);
  });

  it('el número del centro empieza después de que arranca el anillo', () => {
    expect(DELAY.value).toBeGreaterThan(0);
    expect(DELAY.value).toBeLessThan(DURATION.ring);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

```bash
cd trainer-app && npx jest src/lib/__tests__/motion.test.ts
```

Esperado: FALLA — no existe el módulo `../motion`.

- [ ] **Step 3: Implementar**

Crear `trainer-app/src/lib/motion.ts`:

```ts
// Ritmo del movimiento de la app, en un solo lugar.
//
// Todo aparece con desaceleración (rápido al empezar, suave al terminar):
// es lo que hace que una interfaz se sienta viva en vez de mecánica. No hay
// animaciones en bucle a propósito — esta pantalla se abre varias veces por
// sesión de entrenamiento y algo que late sin parar termina molestando.

export const DURATION = {
  /** el anillo llenándose: el gesto principal de la pantalla */
  ring: 1100,
  /** el número del centro apareciendo */
  value: 800,
  /** una fila de ejercicio subiendo */
  row: 500,
} as const;

export const DELAY = {
  /** el número entra con el anillo ya en movimiento, no antes */
  value: 150,
  /** la primera fila espera a que el anillo tenga avance visible */
  rowBase: 300,
  /** separación entre filas consecutivas */
  rowStep: 80,
} as const;

/**
 * Configuración de `withSpring` que produce la desaceleración del diseño.
 * Se usa un resorte y no una curva fija porque interrumpe bien: si el alumno
 * cambia de día a media animación, el resorte reacciona desde donde está en
 * vez de saltar.
 */
export const EASING_OUT = { damping: 18, stiffness: 90, mass: 1 } as const;

/** Máximo de filas que participan de la cascada. */
const MAX_STAGGERED_ROWS = 8;

/**
 * Cuándo entra la fila número `index`. A partir de la octava deja de
 * escalonarse: un día con doce ejercicios tardaría más de un segundo en
 * terminar de dibujarse, y para entonces la animación estorba en vez de
 * ayudar.
 */
export function rowDelay(index: number): number {
  const i = Math.min(Math.max(index, 0), MAX_STAGGERED_ROWS - 1);
  return DELAY.rowBase + DELAY.rowStep * i;
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

```bash
cd trainer-app && npx jest && npx tsc --noEmit -p .
```

Esperado: 62 tests pasan (56 previos + 6 nuevos), sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add trainer-app/src/lib/motion.ts trainer-app/src/lib/__tests__/motion.test.ts
git commit -m "feat(app): sistema de movimiento compartido (duraciones, retardos y cascada)"
```

---

### Task 2: El anillo de progreso

**Files:**
- Create: `trainer-app/src/components/common/ProgressRing.tsx`

**Interfaces:**
- Consumes: `DURATION`, `DELAY`, `EASING_OUT` (Tarea 1); `colors`, `typography`, `fonts` de `trainer-app/src/theme`
- Produces: `<ProgressRing done={number} total={number} size?={number} label?={string} />` — la Tarea 4 lo usa

- [ ] **Step 1: Leer la referencia de animaciones antes de escribir**

Leer `~/.claude/skills/react-native-best-practices/references/animations/animations.md` y `animation-functions.md`. Son las reglas de Software Mansion (los mantenedores de Reanimated) para Reanimated 4, y evitan las trampas de esa versión.

Confirmar también cómo el proyecto usa `react-native-svg` hoy, leyendo `trainer-app/src/components/common/MuscleMap.tsx` — la librería ya es una dependencia, no hay que instalarla.

- [ ] **Step 2: Crear el componente**

Crear `trainer-app/src/components/common/ProgressRing.tsx`:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedProps, useAnimatedStyle, withSpring, withDelay, withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { colors, typography, fonts } from '../../theme';
import { DURATION, DELAY, EASING_OUT } from '../../lib/motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  /** ejercicios completados */
  done: number;
  /** ejercicios del día */
  total: number;
  /** diámetro en px */
  size?: number;
  /** texto bajo el número, en mayúsculas */
  label?: string;
}

/**
 * Anillo de progreso: el dato héroe de la pantalla "Hoy".
 *
 * Es monocromo a propósito. En apps como Whoop el anillo comunica con color
 * (verde/ámbar/rojo); acá el sistema es monocromo y el único color está
 * reservado para las alertas del coach, así que el anillo comunica solo por
 * cuánto se llena — y el número del centro dice explícitamente lo que el
 * color diría.
 */
export default function ProgressRing({ done, total, size = 132, label = 'EJERCICIOS' }: Props) {
  const reduced = useReducedMotion();

  const STROKE = 9;
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = total > 0 ? Math.min(done / total, 1) : 0;

  // 0 = vacío, 1 = lleno
  const progress = useSharedValue(reduced ? ratio : 0);
  const valueOpacity = useSharedValue(reduced ? 1 : 0);

  React.useEffect(() => {
    if (reduced) {
      progress.value = ratio;
      valueOpacity.value = 1;
      return;
    }
    progress.value = withSpring(ratio, EASING_OUT);
    valueOpacity.value = withDelay(DELAY.value, withTiming(1, { duration: DURATION.value }));
  }, [ratio, reduced]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const valueStyle = useAnimatedStyle(() => ({ opacity: valueOpacity.value }));

  return (
    <View style={styles.wrap}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={colors.surface} strokeWidth={STROKE} fill="none"
        />
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={colors.accent} strokeWidth={STROKE} fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          // el anillo arranca arriba, no a la derecha
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Animated.Text style={[styles.value, valueStyle]}>
          {done}/{total}
        </Animated.Text>
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', justifyContent: 'center', alignItems: 'center' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  value: { fontFamily: fonts.display, fontSize: 32, color: colors.textPrimary, letterSpacing: 0.5 },
  label: { fontSize: 8, fontWeight: '800', letterSpacing: 2, color: colors.textMuted, marginTop: -2 },
});
```

**Ojo:** con `total === 0` el anillo debe quedar vacío, no en `NaN`. El ternario de `ratio` ya lo cubre; verificar que se mantenga así al escribirlo, porque es el caso de un día sin ejercicios.

- [ ] **Step 3: Verificar tipos y tests**

```bash
cd trainer-app && npx tsc --noEmit -p . && npx jest
```

Esperado: sin errores de tipos, 62 tests pasan.

- [ ] **Step 4: Commit**

```bash
git add trainer-app/src/components/common/ProgressRing.tsx
git commit -m "feat(app): anillo de progreso animado y monocromo"
```

---

### Task 3: La fila de ejercicio

**Files:**
- Create: `trainer-app/src/components/client/ExerciseRow.tsx`

**Interfaces:**
- Consumes: `DURATION`, `rowDelay`, `EASING_OUT` (Tarea 1); el tipo `PlanExercise` de `trainer-app/src/lib/plan.ts`; `colors`, `typography`, `fonts` del tema
- Produces: `<ExerciseRow exercise={PlanExercise} state={'done'|'next'|'pending'} index={number} lastLog?={{weight:number; reps:number}} onPress={() => void} />` — la Tarea 4 lo usa

- [ ] **Step 1: Crear el componente**

Crear `trainer-app/src/components/client/ExerciseRow.tsx`:

```tsx
import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withDelay, withTiming, withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import { PlanExercise } from '../../lib/plan';
import { colors, spacing, typography, fonts } from '../../theme';
import { DURATION, rowDelay, EASING_OUT } from '../../lib/motion';

export type RowState = 'done' | 'next' | 'pending';

interface Props {
  exercise: PlanExercise;
  state: RowState;
  /** posición en la lista, para escalonar la entrada */
  index: number;
  /** lo que realmente levantó, si ya lo hizo */
  lastLog?: { weight: number; reps: number };
  onPress: () => void;
}

/**
 * Una fila de ejercicio. Deja de ser una tarjeta con borde y miniatura: menos
 * cajas y menos bordes es lo que hace que una pantalla densa se lea cara en
 * vez de recargada.
 *
 * Tres estados con peso visual muy distinto — que todo pesara lo mismo era
 * exactamente el problema del diseño anterior:
 *   done    → atenuado, muestra lo que levantó
 *   next    → blanco puro, más grande, etiquetado SIGUIENTE
 *   pending → gris medio
 */
export default function ExerciseRow({ exercise, state, index, lastLog, onPress }: Props) {
  const reduced = useReducedMotion();

  const opacity = useSharedValue(reduced ? 1 : 0);
  const translateY = useSharedValue(reduced ? 0 : 10);

  React.useEffect(() => {
    if (reduced) {
      opacity.value = 1;
      translateY.value = 0;
      return;
    }
    const delay = rowDelay(index);
    opacity.value = withDelay(delay, withTiming(1, { duration: DURATION.row }));
    translateY.value = withDelay(delay, withSpring(0, EASING_OUT));
  }, [index, reduced]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const isDone = state === 'done';
  const isNext = state === 'next';

  const series = exercise.exercise_series.length;
  const meta = isDone
    ? `HECHO · ${series} SERIES`
    : isNext
      ? `SIGUIENTE · ${series} SERIES · ${exercise.reps_objective}`
      : `${series} SERIES · ${exercise.reps_objective}`;

  // hecho: lo que levantó de verdad. Si no, el peso de referencia del coach.
  const valueText = isDone && lastLog
    ? `${lastLog.weight}×${lastLog.reps}`
    : exercise.ref_weight != null
      ? `${exercise.ref_weight}`
      : '—';

  return (
    <Animated.View style={[styles.row, isDone && styles.rowDone, animStyle]}>
      <TouchableOpacity style={styles.touch} onPress={onPress} activeOpacity={0.6}>
        <Animated.View style={styles.info}>
          <Text style={[styles.name, isNext && styles.nameNext]} numberOfLines={1}>
            {exercise.name}
          </Text>
          <Text style={[styles.meta, isNext && styles.metaNext]}>{meta}</Text>
        </Animated.View>
        <Text style={[styles.value, isNext && styles.valueNext, isDone && styles.valueDone]}>
          {valueText}
          {!isDone && exercise.ref_weight != null && (
            <Text style={styles.unit}>{exercise.unit}</Text>
          )}
        </Text>
        {isDone && <Text style={styles.check}>✓</Text>}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { borderTopWidth: 1, borderTopColor: colors.border },
  rowDone: { opacity: 0.45 },
  touch: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md - 4 },
  info: { flex: 1 },
  name: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  nameNext: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  meta: { fontSize: 9, letterSpacing: 1, color: colors.textMuted, marginTop: 2 },
  metaNext: { color: colors.textPrimary },
  value: { fontFamily: fonts.mono, fontSize: 18, color: colors.textMuted },
  valueNext: { fontSize: 21, color: colors.textPrimary },
  valueDone: { fontSize: 16, color: colors.textMuted },
  unit: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted },
  check: { fontSize: 13, color: colors.textMuted },
});
```

**Nota sobre el blanco puro:** `#FFFFFF` es más claro que `colors.textPrimary` (`#D8D9D7`) y no existe como token. Es deliberado y está aprobado en el diseño: es el único elemento de la pantalla que lo usa, y es lo que hace que el ejercicio siguiente destaque sin recurrir a color. **No agregarlo al tema** ni usarlo en ningún otro lugar.

- [ ] **Step 2: Verificar tipos y tests**

```bash
cd trainer-app && npx tsc --noEmit -p . && npx jest
```

Esperado: sin errores de tipos, 62 tests pasan.

- [ ] **Step 3: Commit**

```bash
git add trainer-app/src/components/client/ExerciseRow.tsx
git commit -m "feat(app): fila de ejercicio con sus tres estados y entrada animada"
```

---

### Task 4: Qué levantó en cada ejercicio

El diseño pide que un ejercicio completado muestre **lo que el alumno levantó** (`60×10`) en vez del peso de referencia. Hoy `TodayScreen` solo guarda un `Set` de ids: sabe *qué* hizo, no *cuánto*.

**No hace falta ninguna consulta nueva.** `fetchLogs` en `trainer-app/src/lib/plan.ts` ya trae `weight` y `reps`; `applyWeek` los descarta al construir el `Set`. Esta tarea agrega una función pura que aprovecha lo que ya viene.

Un ejercicio tiene varias series, así que hay que elegir cuál mostrar: se muestra la **mejor**, por fuerza estimada, usando el mismo `score()` (1RM de Epley) que ya decide la mejor marca en la pantalla de progreso. Que las dos pantallas usen el mismo criterio evita repetir el problema de Marcelo, donde dos vistas discrepaban sobre cuál era su mejor serie.

**Files:**
- Modify: `trainer-app/src/lib/progress.ts` (agregar al final)
- Test: `trainer-app/src/lib/__tests__/progress.test.ts` (agregar al final)

**Interfaces:**
- Consumes: `score(weight, reps)`, ya exportada en `progress.ts`
- Produces: `topSetByExercise(logs: TopSetLog[], seriesToExercise: Record<string, string>): Record<string, { weight: number; reps: number }>` — la Tarea 5 la usa; y el tipo `TopSetLog = { series_id: string; weight: number; reps: number }`

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `trainer-app/src/lib/__tests__/progress.test.ts`:

```ts
import { topSetByExercise } from '../progress';

describe('topSetByExercise', () => {
  const mapa = { s1: 'ex1', s2: 'ex1', s3: 'ex2' };

  it('devuelve la mejor serie de cada ejercicio, no la última', () => {
    const logs = [
      { series_id: 's1', weight: 80, reps: 10 },
      { series_id: 's2', weight: 60, reps: 10 },
      { series_id: 's3', weight: 40, reps: 12 },
    ];
    expect(topSetByExercise(logs, mapa)).toEqual({
      ex1: { weight: 80, reps: 10 },
      ex2: { weight: 40, reps: 12 },
    });
  });

  it('más reps con menos peso puede ser la mejor serie', () => {
    // 60×20 estima más fuerza que 70×8 con Epley
    const logs = [
      { series_id: 's1', weight: 70, reps: 8 },
      { series_id: 's2', weight: 60, reps: 20 },
    ];
    expect(topSetByExercise(logs, mapa).ex1).toEqual({ weight: 60, reps: 20 });
  });

  it('ignora registros de series que no están en el plan', () => {
    const logs = [{ series_id: 'fantasma', weight: 99, reps: 99 }];
    expect(topSetByExercise(logs, mapa)).toEqual({});
  });

  it('sin registros devuelve un objeto vacío', () => {
    expect(topSetByExercise([], mapa)).toEqual({});
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

```bash
cd trainer-app && npx jest src/lib/__tests__/progress.test.ts
```

Esperado: FALLA — `topSetByExercise` no está exportada.

- [ ] **Step 3: Implementar**

Agregar al final de `trainer-app/src/lib/progress.ts`:

```ts
export interface TopSetLog {
  series_id: string;
  weight: number;
  reps: number;
}

/**
 * La mejor serie registrada de cada ejercicio, para mostrarla en "Hoy" en los
 * ejercicios ya completados.
 *
 * Usa el mismo `score` que `bestSet`: si dos pantallas de la app usaran
 * criterios distintos para "la mejor serie", volveríamos a tener un alumno
 * viendo dos números diferentes para lo mismo.
 */
export function topSetByExercise(
  logs: TopSetLog[],
  seriesToExercise: Record<string, string>,
): Record<string, { weight: number; reps: number }> {
  const mejores: Record<string, { weight: number; reps: number }> = {};
  logs.forEach(l => {
    const exId = seriesToExercise[l.series_id];
    if (!exId) return; // registro de una serie que ya no está en el plan
    const actual = mejores[exId];
    if (!actual || score(l.weight, l.reps) > score(actual.weight, actual.reps)) {
      mejores[exId] = { weight: l.weight, reps: l.reps };
    }
  });
  return mejores;
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

```bash
cd trainer-app && npx jest && npx tsc --noEmit -p .
```

Esperado: 66 tests pasan (62 + 4 nuevos), sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add trainer-app/src/lib/progress.ts trainer-app/src/lib/__tests__/progress.test.ts
git commit -m "feat(app): mejor serie por ejercicio, para mostrar lo levantado en Hoy"
```

---

### Task 5: Componer la pantalla "Hoy"

La tarea grande. Reemplaza el bloque visual de `TodayScreen` conservando intacta toda su lógica.

**Files:**
- Modify: `trainer-app/src/screens/client/TodayScreen.tsx`

**Interfaces:**
- Consumes: `<ProgressRing done total size? label? />` (Tarea 2); `<ExerciseRow exercise state index lastLog? onPress />` con `RowState = 'done'|'next'|'pending'` (Tarea 3); `topSetByExercise(logs, seriesToExercise)` (Tarea 4); `groupBySuperseries(exercises)` de `trainer-app/src/lib/plan.ts`, que ya existe y devuelve `{ key, superseries, exercises }[]`
- Produces: nada

**Imports a agregar** en la cabecera del archivo: `fonts` al import del tema (hoy trae `colors, spacing, radius, typography`), más `ProgressRing`, `ExerciseRow` con su tipo `RowState`, y `topSetByExercise`.

- [ ] **Step 1: Leer la pantalla completa antes de tocarla**

Leer `trainer-app/src/screens/client/TodayScreen.tsx` de principio a fin (745 líneas). **Toda la lógica de estado y datos se conserva sin cambios**: `fetchWeek`, `loadNote`, `saveNote`, `saveCardio`, y el estado `days`, `selectedDay`, `exercises`, `loggedExercises`, `dayStatus`, `selectedWeek`, `noPlanForWeek`, `noPlanAtAll`, `cardioLogs`. Si algo del rediseño parece exigir cambiarlas, PARAR y reportar.

**La única excepción es `applyWeek`** (línea ~120), y solo para guardar un dato que ya llega y hoy se bota:

```tsx
  const [topSets, setTopSets] = useState<Record<string, { weight: number; reps: number }>>({});
```

Ampliar el tipo del parámetro `logs` de `applyWeek` a `{ series_id: string; week_number: number; weight: number; reps: number }[]` — `fetchLogs` ya los entrega, el tipo solo los estaba ocultando — y agregar una línea junto a `setLoggedExercises(doneEx)`:

```tsx
    setTopSets(topSetByExercise(logs, seriesToExercise));
```

Nada más de `applyWeek` cambia: ni el `Set`, ni `dayStatus`, ni `refreshReminders`, ni la lógica de selección de día.

- [ ] **Step 2: Reemplazar la cabecera y el progreso por el anillo**

Hoy la cabecera (`styles.header`) muestra fecha, nombre del alumno y una insignia con el número de día; luego viene `styles.weekNav` con las flechas; y más abajo `styles.progressRow` con una barra de 5px.

Sustituir esos tres bloques por: una línea superior con la fecha a la izquierda y la navegación de semana a la derecha, y debajo el anillo centrado con el nombre del día.

```tsx
      <View style={styles.topBar}>
        <Text style={styles.date}>{formatShortDate(new Date().toISOString()).toUpperCase()}</Text>
        {!loading && days.length > 0 && (
          <View style={styles.weekNav}>
            <TouchableOpacity
              onPress={() => setSelectedWeek(w => Math.max(1, w - 1))}
              disabled={selectedWeek <= 1}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={13}
                color={selectedWeek <= 1 ? colors.border : colors.textMuted} />
            </TouchableOpacity>
            <Text style={styles.weekLabel}>SEMANA {selectedWeek}</Text>
            <TouchableOpacity
              onPress={() => setSelectedWeek(w => Math.min(currentWeek, w + 1))}
              disabled={selectedWeek >= currentWeek}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-forward" size={13}
                color={selectedWeek >= currentWeek ? colors.border : colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {!loading && selectedDay && exercises.length > 0 && (
        <View style={styles.hero}>
          <ProgressRing
            done={dayStatus[selectedDay.id]?.done ?? 0}
            total={exercises.length}
          />
          <Text style={styles.dayName}>{selectedDay.name.toUpperCase()}</Text>
        </View>
      )}
```

Agregar los estilos correspondientes al `StyleSheet`:

```tsx
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingTop: spacing.xs,
  },
  date: { fontSize: 9, letterSpacing: 2, fontWeight: '800', color: colors.textMuted },
  weekLabel: { fontSize: 9, letterSpacing: 1, fontWeight: '800', color: colors.textMuted },
  hero: { alignItems: 'center', paddingTop: spacing.md, paddingBottom: spacing.xs },
  dayName: { fontFamily: fonts.display, fontSize: 24, color: colors.textPrimary, letterSpacing: 0.5, marginTop: 2 },
```

Reutilizar el estilo `weekNav` que ya existe, ajustándolo a `{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }` y quitándole el `paddingHorizontal` y el `marginBottom` (ahora vive dentro de `topBar`).

- [ ] **Step 3: Reducir el selector de días a píldoras**

El selector actual (`styles.dayTab`) son botones de 82px de ancho mínimo con dos líneas de texto. Reemplazar el contenido de cada `TouchableOpacity` del `ScrollView` horizontal por una sola línea, y ajustar sus estilos:

```tsx
                  <Text style={[styles.dayPillText, active && styles.dayPillTextActive]}>
                    DÍA {day.day_number}
                  </Text>
```

Estilos nuevos (reemplazan `dayTab`, `dayTabActive`, `dayTabDone`, `dayTabNum`, `dayTabName`, `dayTabNumActive`, `dayTabNameActive`, que se eliminan):

```tsx
  dayPill: {
    paddingHorizontal: spacing.sm + 3, paddingVertical: 4,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
  },
  dayPillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayPillDone: { borderColor: colors.borderLight },
  dayPillText: { fontSize: 9, letterSpacing: 1, fontWeight: '800', color: colors.textMuted },
  dayPillTextActive: { color: colors.background },
```

Conservar el punto de "hoy" (`styles.todayDot`) y la insignia de completado (`styles.tabBadge`), reduciéndolos proporcionalmente.

- [ ] **Step 4: Cambiar las tarjetas de ejercicio por filas, con el corchete de biserie**

Reemplazar el bloque que hoy recorre `groupBySuperseries(exercises)` — el que usa `groupColor`, `styles.superGroup`, `styles.superGroupTag` y las `Card` con `styles.exerciseCard` — por filas.

Antes del `return` del componente, calcular el índice global de cada ejercicio y cuál es el siguiente:

```tsx
  // el primer ejercicio sin registrar es "el siguiente"; el resto, pendientes
  const nextExerciseId = exercises.find(e => !loggedExercises.has(e.id))?.id ?? null;
  const rowState = (exId: string): RowState =>
    loggedExercises.has(exId) ? 'done' : exId === nextExerciseId ? 'next' : 'pending';
```

Y el render de los grupos:

```tsx
            {(() => {
              let rowIndex = -1;
              return groupBySuperseries(exercises).map(group => {
                const encadenado = group.exercises.length > 1;
                const etiqueta = group.exercises.length >= 3 ? 'TRISERIE' : 'BISERIE';
                return (
                  <View key={group.key} style={encadenado ? styles.chain : undefined}>
                    {encadenado && <Text style={styles.chainLabel}>{etiqueta}</Text>}
                    {group.exercises.map(ex => {
                      rowIndex += 1;
                      return (
                        <ExerciseRow
                          key={ex.id}
                          exercise={ex}
                          state={rowState(ex.id)}
                          index={rowIndex}
                          lastLog={topSets[ex.id]}
                          onPress={() => navigation.navigate('WorkoutLog', {
                            exercise: ex,
                            week: selectedWeek,
                            date: viewingPastWeek && selectedDay?.week_day != null
                              ? dateForWeekDay(selectedWeek, selectedDay.week_day).toISOString()
                              : new Date().toISOString(),
                          })}
                        />
                      );
                    })}
                  </View>
                );
              });
            })()}
```

Estilos del corchete (reemplazan `superGroup`, `superGroupTag`, `superGroupTagText`, que se eliminan):

```tsx
  chain: {
    borderLeftWidth: 2, borderLeftColor: colors.borderLight,
    paddingLeft: spacing.sm, marginLeft: 2,
  },
  chainLabel: {
    fontSize: 8, fontWeight: '900', letterSpacing: 2,
    color: colors.textMuted, marginTop: spacing.sm,
  },
```

**Eliminar del archivo** la constante `GROUP_COLORS` y la función `groupColor` — quedan sin uso, y son las que contradecían el monocromo.

**Ojo con el comentario que hay que conservar:** el bloque de `date:` que se pasa a `WorkoutLog` lleva hoy un comentario largo explicando por qué se usa la fecha real y no la calendarizada. Ese comentario documenta un bug ya corregido: **conservarlo** (arriba se omitió por brevedad, pero debe seguir en el archivo).

- [ ] **Step 5: Bajar cardio y nota al final**

La tarjeta de cardio (`styles.cardioCard`) está hoy arriba de los ejercicios. Moverla **después** de la lista de ejercicios, junto a la nota al coach, y bajarle el contraste: quitarle el fondo de `Card` y dejar solo borde.

Mantener intactos `saveCardio`, el modal de cardio y toda su lógica; solo cambia dónde se renderiza el bloque y su estilo.

- [ ] **Step 6: Verificar**

```bash
cd trainer-app && npx tsc --noEmit -p . && npx jest
```

Esperado: sin errores de tipos, 66 tests pasan.

Revisar además que **no quedaron estilos huérfanos**: buscar en el archivo `exerciseCard`, `thumb`, `superGroup`, `dayTabNum` y `progressTrack`; si ya nadie los usa, eliminarlos del `StyleSheet`.

- [ ] **Step 7: Commit**

```bash
git add trainer-app/src/screens/client/TodayScreen.tsx
git commit -m "feat(app): Hoy con anillo héroe, filas de ejercicio y jerarquía por estado"
```

---

### Task 6: Verificación en dispositivo

**Files:** ninguno (solo verificación)

**Interfaces:**
- Consumes: todo lo anterior
- Produces: nada

- [ ] **Step 1: Verificación local**

```bash
cd trainer-app && npx jest && npx tsc --noEmit -p .
```

Esperado: 66 tests, sin errores de tipos.

- [ ] **Step 2: Confirmar que el monocromo quedó intacto**

```bash
cd /Users/sebastianazocarmondaca/Desktop/APP_trainer
git diff sandbox -- trainer-app/src/theme/index.ts
grep -rn "GROUP_COLORS\|groupColor" trainer-app/src/screens/client/TodayScreen.tsx
grep -rn "#[0-9a-fA-F]\{6\}" trainer-app/src/components/client/ExerciseRow.tsx trainer-app/src/components/common/ProgressRing.tsx
```

Esperado: el primero **sin salida** (el tema no cambió); el segundo **sin salida** (los colores de biserie se fueron); el tercero solo `#FFFFFF` en `ExerciseRow`, que es la excepción aprobada.

- [ ] **Step 3: Build de TestFlight**

El coordinador lanza `npx eas-cli build --platform ios --profile production --non-interactive --auto-submit` y avisa al dueño que la compilación debe agregarse a mano al grupo "Coaches Beta" en App Store Connect.

- [ ] **Step 4: Casos a mirar en el teléfono**

Con la cuenta `appreview.client@elitefitapp.com` / `AppleReview2026!` o con una cuenta beta real:

1. **Día sin registrar** — anillo vacío, primer ejercicio en blanco con `SIGUIENTE`.
2. **Día a medias** — anillo parcial, los hechos atenuados mostrando lo levantado, el siguiente destacado.
3. **Día completo** — anillo lleno, ningún ejercicio en blanco.
4. **Día con biserie** — corchete a la izquierda uniendo las filas encadenadas, sin color.
5. **Semana sin planificar** — el estado "sin plan" sigue apareciendo, sin anillo.
6. **Día con muchos ejercicios (8+)** — la cascada se corta y la pantalla no tarda en dibujarse.
7. **Con "Reducir movimiento" activado** en Ajustes → Accesibilidad → Movimiento: todo aparece completo, sin animación.

---

## Fuera de alcance (explícito)

- El resto de las pantallas del alumno (Inicio, Progreso, Perfil) y toda la app del coach: esta pantalla fija el lenguaje, propagarlo es trabajo posterior.
- La web.
- Unificar cómo se ven las biseries en las pantallas del coach (`PlanEditorScreen`, `ProgramEditorScreen`) y en los editores web, que siguen usando color.
- Cambiar cualquier token del tema.
- Cualquier cambio de datos, consultas o lógica de negocio.
