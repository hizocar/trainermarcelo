# Armonía en la app del alumno · Parte 1: el kit y las tres pantallas con héroe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que "Hoy" deje de ser la única pantalla diseñada: se extrae su lenguaje visual a componentes compartidos y se aplica a las tres pantallas que tienen un dato que merece dominar.

**Architecture:** Primero un kit de cuatro componentes de presentación que generalizan lo que `TodayScreen` ya tiene funcionando; después las pantallas los componen. Ninguna consulta ni lógica de negocio cambia: el único cálculo nuevo es una función pura, con tests, para elegir qué récord mostrar en Progreso.

**Tech Stack:** React Native / Expo SDK 54, RN 0.81.5, Reanimated 4.1.1, Jest.

## Por qué este plan es la mitad

El diseño cubre siete pantallas. Se parte en dos planes porque cada mitad entrega software funcionando por sí sola y siete pantallas son demasiadas para revisar de un tirón:

- **Parte 1 (este plan):** el kit compartido + `WorkoutLogScreen`, `HomeScreen`, `ProgressScreen`.
- **Parte 2 (plan aparte, después):** re-vestir `CoachProfileScreen`, `HistoryScreen`, `SessionDetailScreen` y `BodyProgressScreen` con el mismo kit.

El orden está elegido para que, si hay que parar a mitad de camino, lo entregado ya mejore la armonía en vez de dejarla peor: `WorkoutLogScreen` está a un toque de "Hoy" y es la ruptura más fuerte.

## Global Constraints

- **Rama:** trabajar en `feat/armonia-alumno`, creada **desde `feat/hoy-estetica`** (no desde `sandbox`): este trabajo se apoya en el kit de movimiento y en los componentes de esa rama, que todavía no está fusionada. **NUNCA commitear ni pushear a `sandbox`** — despliega automáticamente a producción, donde hay seis coaches beta y sus alumnos usando el producto.
- **Solo se toca `trainer-app/`.** No se modifica `web/`, ni la app del coach (`src/screens/coach/`), ni hay migraciones de base de datos.
- **Ningún dato, consulta ni lógica de negocio cambia.** Es presentación. Si una pantalla parece exigir una consulta nueva, PARAR y reportarlo.
- **Ninguna función se elimina.** En `WorkoutLogScreen` eso incluye explícitamente: guardado automático, sugerencia de subir peso, chips de "¿cuándo lo hiciste?", historial, video y mapa muscular.
- **El tema no se modifica** (`trainer-app/src/theme/index.ts`). El `#FFFFFF` del elemento "en curso" es la única excepción de color y **no se agrega al tema**.
- **Monocromo estricto.** El ámbar `colors.warning` está reservado para "esto requiere que el coach haga algo" y no se usa en ninguna pantalla del alumno. En `ProgressScreen` se eliminan el verde y el rojo de "mejorando/por mejorar".
- **`ExerciseRow` no se modifica.** Es específico de "Hoy", ya está verificado, y reescribirlo sobre la abstracción nueva es riesgo sin beneficio.
- **Reanimated 4:** nunca usar `runOnJS` — se eliminó; el reemplazo es `scheduleOnRN` de `react-native-worklets`. Toda animación respeta `useReducedMotion()`.
- **Nada de contadores animados.** Las cifras héroe aparecen con un fundido, no contando hacia arriba: `WorkoutLogScreen` se abre entre serie y serie.
- **Idioma:** UI y comentarios en español de Chile.
- **Commits:** uno por tarea, en español (`feat:` / `fix:` / `refactor:`).
- Los **68 tests** existentes de `trainer-app/` deben seguir pasando y `npx tsc --noEmit -p .` quedar limpio en cada tarea.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `trainer-app/src/components/common/SectionLabel.tsx` | **crear** — la etiqueta de sección de 8px, hoy repetida en cinco pantallas |
| `trainer-app/src/components/common/ScreenHeader.tsx` | **crear** — la barra superior: título a la izquierda, acción a la derecha |
| `trainer-app/src/components/common/StatHero.tsx` | **crear** — la cifra héroe con su etiqueta |
| `trainer-app/src/components/common/DataRow.tsx` | **crear** — la fila genérica, con sus tres estados y su entrada escalonada |
| `trainer-app/src/lib/progress.ts` | **modificar** — se le agrega `latestRecord` |
| `trainer-app/src/lib/__tests__/progress.test.ts` | **modificar** — tests de `latestRecord` |
| `trainer-app/src/screens/client/WorkoutLogScreen.tsx` | **modificar** — héroe + series como filas |
| `trainer-app/src/screens/client/HomeScreen.tsx` | **modificar** — héroe de la semana + filas |
| `trainer-app/src/screens/client/ProgressScreen.tsx` | **modificar** — héroe del récord + filas, sin verde ni rojo |

Los cuatro componentes del kit son de presentación pura: sin estado de negocio, sin Supabase, sin navegación. Reciben datos por props y dibujan. Eso es lo que los hace reutilizables en la Parte 2 sin arrastrar dependencias.

---

### Task 1: Las dos piezas simples del kit

`SectionLabel` y `ScreenHeader` son las que más se repiten y las de menor riesgo: empezar por acá deja el patrón instalado antes de tocar nada complejo.

**Files:**
- Create: `trainer-app/src/components/common/SectionLabel.tsx`
- Create: `trainer-app/src/components/common/ScreenHeader.tsx`

**Interfaces:**
- Consumes: `colors`, `spacing`, `fonts` de `trainer-app/src/theme`
- Produces:
  - `<SectionLabel>TEXTO</SectionLabel>` — export default, prop `children: string`, opcional `style?: ViewStyle`
  - `<ScreenHeader left={string} right?={ReactNode} onBack?={() => void} />` — export default

- [ ] **Step 1: Crear `SectionLabel`**

```tsx
import React from 'react';
import { Text, StyleSheet, TextStyle, StyleProp } from 'react-native';
import { colors } from '../../theme';

interface Props {
  children: string;
  style?: StyleProp<TextStyle>;
}

/**
 * La etiqueta que encabeza una sección. Estaba copiada con medidas apenas
 * distintas en cinco pantallas — que sea un componente es lo que evita que
 * vuelvan a divergir.
 */
export default function SectionLabel({ children, style }: Props) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: { fontSize: 8, fontWeight: '800', letterSpacing: 2, color: colors.textMuted },
});
```

- [ ] **Step 2: Crear `ScreenHeader`**

```tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';

interface Props {
  /** texto de la izquierda: fecha o título, ya en mayúsculas */
  left: string;
  /** lo que va a la derecha: navegación de semana, un botón, o nada */
  right?: React.ReactNode;
  /** si se pasa, la izquierda se vuelve un botón "atrás" */
  onBack?: () => void;
}

/**
 * La barra superior de una pantalla del alumno. Deliberadamente liviana: en
 * este lenguaje la cabecera no compite, el dato héroe manda.
 */
export default function ScreenHeader({ left, right, onBack }: Props) {
  return (
    <View style={styles.bar}>
      {onBack ? (
        <TouchableOpacity
          style={styles.back}
          onPress={onBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={13} color={colors.textMuted} />
          <Text style={styles.text}>{left}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.text}>{left}</Text>
      )}
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingTop: spacing.xs,
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -4 },
  text: { fontSize: 9, letterSpacing: 2, fontWeight: '800', color: colors.textMuted },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
```

- [ ] **Step 3: Verificar**

```bash
cd trainer-app && npx tsc --noEmit -p . && npx jest
```

Esperado: sin errores de tipos, 68 tests pasan.

- [ ] **Step 4: Commit**

```bash
git add trainer-app/src/components/common/SectionLabel.tsx trainer-app/src/components/common/ScreenHeader.tsx
git commit -m "feat(app): etiqueta de sección y cabecera compartidas"
```

---

### Task 2: El dato héroe y la fila genérica

Las dos piezas con peso visual del kit.

**Files:**
- Create: `trainer-app/src/components/common/StatHero.tsx`
- Create: `trainer-app/src/components/common/DataRow.tsx`

**Interfaces:**
- Consumes: `DURATION`, `DELAY`, `rowDelay`, `EASING_OUT` de `trainer-app/src/lib/motion.ts`; `colors`, `spacing`, `fonts` del tema
- Produces:
  - `<StatHero value={string} unit?={string} suffix?={string} label={string} caption?={string} font?={'display'|'mono'} size?={number} />` — export default
  - `<DataRow label={string} meta?={string} value={string} unit?={string} state?={'done'|'active'|'idle'} index={number} onPress?={() => void} />` — export default, y exporta el tipo `DataRowState = 'done' | 'active' | 'idle'`

- [ ] **Step 1: Crear `StatHero`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withDelay, withTiming, useReducedMotion,
} from 'react-native-reanimated';
import { colors, spacing, fonts } from '../../theme';
import { DURATION, DELAY } from '../../lib/motion';

interface Props {
  /** la cifra, ya formateada */
  value: string;
  /** unidad pequeña pegada a la cifra: "kg" */
  unit?: string;
  /** continuación atenuada: "/5", "×8" */
  suffix?: string;
  /** etiqueta bajo la cifra, en mayúsculas */
  label: string;
  /** línea extra bajo la etiqueta */
  caption?: string;
  /** Anton para conteos, mono para pesos y marcas */
  font?: 'display' | 'mono';
  size?: number;
}

/**
 * La cifra que domina una pantalla.
 *
 * Aparece con un fundido, nunca contando hacia arriba: un contador envejece
 * mal y estas pantallas se abren muchas veces por sesión — en "Registrar
 * ejercicio", entre serie y serie.
 */
export default function StatHero({
  value, unit, suffix, label, caption, font = 'display', size = 52,
}: Props) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(reduced ? 1 : 0);

  React.useEffect(() => {
    if (reduced) {
      opacity.value = 1;
      return;
    }
    opacity.value = withDelay(DELAY.value, withTiming(1, { duration: DURATION.value }));
  }, [reduced]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const familia = font === 'mono' ? fonts.mono : fonts.display;

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.figure, animStyle]}>
        <Text style={[styles.value, { fontFamily: familia, fontSize: size }]}>{value}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
        {suffix ? (
          <Text style={[styles.suffix, { fontFamily: familia, fontSize: size * 0.46 }]}>{suffix}</Text>
        ) : null}
      </Animated.View>
      <Text style={styles.label}>{label}</Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  figure: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  value: { color: colors.textPrimary },
  unit: { fontSize: 13, color: colors.textMuted },
  suffix: { color: colors.textMuted },
  label: { fontSize: 8, fontWeight: '800', letterSpacing: 2, color: colors.textMuted, marginTop: spacing.xs },
  caption: { fontSize: 8, letterSpacing: 2, color: colors.textMuted, marginTop: 2, opacity: 0.7 },
});
```

Los tokens usados existen todos en el tema (`background`, `surface`, `accent`, `textPrimary`, `textMuted`, `border`, `borderLight`). **No agregues tokens nuevos ni modifiques el tema.**

- [ ] **Step 2: Crear `DataRow`**

Es `ExerciseRow` generalizado: mismos tres estados y misma entrada escalonada, pero recibiendo textos en vez de un `PlanExercise`.

```tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withDelay, withTiming, withSpring, useReducedMotion,
} from 'react-native-reanimated';
import { colors, spacing, fonts } from '../../theme';
import { DURATION, rowDelay, EASING_OUT } from '../../lib/motion';

export type DataRowState = 'done' | 'active' | 'idle';

interface Props {
  /** texto principal */
  label: string;
  /** línea secundaria, en mayúsculas */
  meta?: string;
  /** la cifra de la derecha, ya formateada */
  value: string;
  /** unidad pequeña pegada a la cifra */
  unit?: string;
  state?: DataRowState;
  /** posición en la lista, para escalonar la entrada */
  index: number;
  onPress?: () => void;
}

/**
 * Una fila de datos: el ladrillo de este lenguaje visual.
 *
 * Tres estados con peso muy distinto, igual que en "Hoy":
 *   done   → atenuado, con ✓
 *   active → blanco puro, más grande
 *   idle   → gris medio
 */
export default function DataRow({
  label, meta, value, unit, state = 'idle', index, onPress,
}: Props) {
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

  const isDone = state === 'done';
  const isActive = state === 'active';

  // El atenuado va DENTRO del estilo animado: al aplanar [estático, animStyle]
  // gana el último, y animStyle termina con opacity 1. Ese error dejó las filas
  // completadas de "Hoy" sin atenuar hasta que lo cazó una revisión.
  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * (isDone ? 0.45 : 1),
    transform: [{ translateY: translateY.value }],
  }), [isDone]);

  const contenido = (
    <View style={styles.inner}>
      <View style={styles.info}>
        <Text style={[styles.label, isActive && styles.labelActive]} numberOfLines={2}>
          {label}
        </Text>
        {meta ? <Text style={[styles.meta, isActive && styles.metaActive]}>{meta}</Text> : null}
      </View>
      <Text style={[styles.value, isActive && styles.valueActive, isDone && styles.valueDone]}>
        {value}
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </Text>
      {isDone ? <Text style={styles.check}>✓</Text> : null}
    </View>
  );

  return (
    <Animated.View style={[styles.row, animStyle]}>
      {onPress ? (
        <TouchableOpacity onPress={onPress} activeOpacity={0.6}>{contenido}</TouchableOpacity>
      ) : (
        contenido
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { borderTopWidth: 1, borderTopColor: colors.border },
  inner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md - 4 },
  info: { flex: 1 },
  label: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  labelActive: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  meta: { fontSize: 9, letterSpacing: 1, color: colors.textMuted, marginTop: 2 },
  metaActive: { color: colors.textPrimary },
  value: { fontFamily: fonts.mono, fontSize: 18, color: colors.textMuted },
  valueActive: { fontSize: 21, color: colors.textPrimary },
  valueDone: { fontSize: 16, color: colors.textMuted },
  unit: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted },
  check: { fontSize: 13, color: colors.textMuted },
});
```

- [ ] **Step 3: Verificar**

```bash
cd trainer-app && npx tsc --noEmit -p . && npx jest
```

Esperado: sin errores de tipos, 68 tests pasan.

- [ ] **Step 4: Commit**

```bash
git add trainer-app/src/components/common/StatHero.tsx trainer-app/src/components/common/DataRow.tsx
git commit -m "feat(app): dato héroe y fila de datos compartidos"
```

---

### Task 3: Qué récord se muestra en Progreso

El diseño dice que Progreso abre con "tu mejor marca". Hay que definir **cuál**: comparar 1RM estimado entre ejercicios distintos siempre elegiría el más pesado (sentadilla o peso muerto), y la pantalla mostraría el mismo número para siempre.

Se muestra el **récord más reciente**: el ejercicio cuya mejor marca se consiguió en la semana más alta. Cambia a medida que el alumno progresa, que es lo que hace que valga la pena mirarlo. Ante empate de semana gana la marca de mayor fuerza estimada, usando el mismo `score` que el resto de la app.

**Files:**
- Modify: `trainer-app/src/lib/progress.ts` (agregar al final)
- Test: `trainer-app/src/lib/__tests__/progress.test.ts` (agregar al final)

**Interfaces:**
- Consumes: `score(weight, reps)`, ya exportada en `progress.ts`
- Produces: `latestRecord(records: ExerciseRecord[]): ExerciseRecord | null` y el tipo `ExerciseRecord = { name: string; unit: string; best: { weight: number; reps: number; week: number } }` — la Tarea 6 los usa

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `trainer-app/src/lib/__tests__/progress.test.ts`:

```ts
import { latestRecord } from '../progress';

describe('latestRecord', () => {
  const sentadilla = { name: 'Sentadilla', unit: 'kg', best: { weight: 140, reps: 8, week: 7 } };
  const prensa = { name: 'Prensa', unit: 'kg', best: { weight: 200, reps: 10, week: 3 } };

  it('gana el récord más reciente, aunque sea de menos peso', () => {
    expect(latestRecord([prensa, sentadilla])).toEqual(sentadilla);
  });

  it('ante empate de semana gana la marca de mayor fuerza estimada', () => {
    const a = { name: 'A', unit: 'kg', best: { weight: 100, reps: 5, week: 9 } };
    const b = { name: 'B', unit: 'kg', best: { weight: 90, reps: 12, week: 9 } };
    // score: A = 100*(1+5/30) = 116.7 ; B = 90*(1+12/30) = 126
    expect(latestRecord([a, b])).toEqual(b);
  });

  it('ignora los ejercicios sin registros', () => {
    // week 0 es el centinela de "sin datos" que usa ProgressScreen
    const vacio = { name: 'Vacío', unit: 'kg', best: { weight: 0, reps: 0, week: 0 } };
    expect(latestRecord([vacio, prensa])).toEqual(prensa);
  });

  it('sin ningún récord real devuelve null', () => {
    const vacio = { name: 'Vacío', unit: 'kg', best: { weight: 0, reps: 0, week: 0 } };
    expect(latestRecord([vacio])).toBeNull();
    expect(latestRecord([])).toBeNull();
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

```bash
cd trainer-app && npx jest src/lib/__tests__/progress.test.ts
```

Esperado: FALLA — `latestRecord` no está exportada.

- [ ] **Step 3: Implementar**

Agregar al final de `trainer-app/src/lib/progress.ts`:

```ts
export interface ExerciseRecord {
  name: string;
  unit: string;
  best: { weight: number; reps: number; week: number };
}

/**
 * El récord más reciente del alumno, para encabezar la pantalla de progreso.
 *
 * No se elige "la marca más pesada": comparar 1RM entre ejercicios distintos
 * siempre daría sentadilla o peso muerto, y la pantalla mostraría el mismo
 * número para siempre. El récord más reciente, en cambio, se mueve cuando el
 * alumno progresa — que es lo que da ganas de mirarlo.
 *
 * Ante empate de semana gana la mayor fuerza estimada, con el mismo `score`
 * que usan `bestSet` y `topSetByExercise`.
 */
export function latestRecord(records: ExerciseRecord[]): ExerciseRecord | null {
  const conDatos = records.filter(r => r.best.week > 0 && r.best.weight > 0);
  if (conDatos.length === 0) return null;
  return conDatos.reduce((mejor, cur) => {
    if (cur.best.week !== mejor.best.week) return cur.best.week > mejor.best.week ? cur : mejor;
    return score(cur.best.weight, cur.best.reps) > score(mejor.best.weight, mejor.best.reps)
      ? cur
      : mejor;
  });
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

```bash
cd trainer-app && npx jest && npx tsc --noEmit -p .
```

Esperado: 72 tests pasan (68 + 4 nuevos), sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add trainer-app/src/lib/progress.ts trainer-app/src/lib/__tests__/progress.test.ts
git commit -m "feat(app): elegir el récord más reciente para encabezar Progreso"
```

---

### Task 4: Registrar ejercicio

La pantalla de más riesgo del plan y la de más impacto: está a un toque de "Hoy" y es donde el alumno pasa la sesión. **Su lógica no se toca.**

**Files:**
- Modify: `trainer-app/src/screens/client/WorkoutLogScreen.tsx`

**Interfaces:**
- Consumes: `<ScreenHeader left right? onBack? />` (Tarea 1); `<SectionLabel>` (Tarea 1); `<StatHero value unit? suffix? label caption? font? size? />` (Tarea 2)
- Produces: nada

- [ ] **Step 1: Leer la pantalla completa antes de tocarla**

Leer `trainer-app/src/screens/client/WorkoutLogScreen.tsx` (764 líneas) de principio a fin. **Toda la lógica se conserva sin cambios**: el guardado automático, `saveAll`, `updateEntry`, el estado `entries`, la sugerencia (`suggestion` / `applySuggestion`), los chips de fecha, el historial, el video y el mapa muscular. Un error acá le pierde datos a un alumno en mitad de una sesión: si algo del rediseño parece exigir tocar esa lógica, PARAR y reportar.

- [ ] **Step 2: Cabecera y dato héroe**

Reemplazar el bloque `styles.header` actual (que hoy tiene el botón atrás, el nombre en `styles.exerciseName` display 28, el botón de historial y la línea `styles.meta`) por la cabecera compartida más el héroe:

```tsx
      <ScreenHeader
        left="ATRÁS"
        onBack={() => navigation.goBack()}
        right={
          <TouchableOpacity onPress={() => setShowHistory(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.headerAction}>HISTORIAL</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.hero}>
        <Text style={styles.exerciseName}>{exercise.name.toUpperCase()}</Text>
        {exercise.name_en ? <Text style={styles.nameEn}>{exercise.name_en}</Text> : null}
        <View style={styles.heroStat}>
          <StatHero
            value={exercise.ref_weight != null ? `${exercise.ref_weight}` : '—'}
            unit={exercise.ref_weight != null ? exercise.unit : undefined}
            label="REFERENCIA DEL COACH"
            caption={`${formatShortDate(logDate).toUpperCase()} · OBJETIVO ${exercise.reps_objective}`}
            font="mono"
            size={38}
          />
        </View>
      </View>
```

Estilos nuevos:

```tsx
  headerAction: { fontSize: 9, letterSpacing: 2, fontWeight: '800', color: colors.textMuted },
  hero: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md },
  exerciseName: {
    fontFamily: fonts.display, fontSize: 26, color: colors.textPrimary,
    letterSpacing: 0.5, textAlign: 'center',
  },
  heroStat: { marginTop: spacing.sm },
```

Conservar `nameEn` como está. Eliminar del `StyleSheet` los estilos que queden huérfanos (`nameRow`, `histBtn`, `histBtnText`, `backBtn`, `backText`, `meta`, y el `header` viejo) — solo si ya nadie los usa.

- [ ] **Step 3: Las series pasan de tarjetas a filas**

El bloque actual usa `styles.tableHeader` con cuatro `styles.th`, y cada serie es una `View` con `styles.row` / `styles.rowSaved`, un `styles.seriesBadge` y tres `TextInput` con `styles.input`. **Los `TextInput` y sus handlers no cambian**: cambia el envoltorio visual.

Sustituir el encabezado de tabla y la fila por:

```tsx
        <View style={styles.tableHeader}>
          <View style={{ width: 26 }} />
          <SectionLabel style={{ flex: 1 }}>PESO ({exercise.unit.toUpperCase()})</SectionLabel>
          <SectionLabel style={{ flex: 1 }}>REPS</SectionLabel>
          <SectionLabel style={{ flex: 0.7 }}>RIR</SectionLabel>
        </View>
```

y, dentro del `entries.map`, el envoltorio de cada serie:

```tsx
            <View style={[styles.serieRow, entry.saved && styles.serieRowSaved, esActiva && styles.serieRowActive]}>
              <Text style={[styles.serieNum, esActiva && styles.serieNumActive]}>
                S{entry.series.series_number}
              </Text>
              {/* los tres TextInput van acá, sin cambios en value/onChangeText/keyboardType */}
              {entry.saved && <Ionicons name="checkmark" size={13} color={colors.textMuted} />}
            </View>
```

Antes del `map`, calcular cuál es la serie en curso — la primera sin guardar:

```tsx
  // la primera serie sin guardar es la que el alumno está haciendo ahora
  const indiceActivo = entries.findIndex(e => !e.saved);
```

y dentro del `map`, `const esActiva = i === indiceActivo;`.

Estilos nuevos (reemplazan `row`, `rowSaved`, `seriesBadge`, `seriesText`, que se eliminan):

```tsx
  serieRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: spacing.sm,
  },
  serieRowSaved: { opacity: 0.45 },
  serieRowActive: { borderTopColor: colors.accent },
  serieNum: { width: 26, fontSize: 10, letterSpacing: 1, fontWeight: '800', color: colors.textMuted },
  serieNumActive: { color: '#FFFFFF' },
```

Ajustar `styles.input` para que la cifra se lea de reojo: `fontFamily: fonts.mono`, `fontSize: 19`, fondo `colors.surface`, sin borde, `borderRadius: radius.sm`, `paddingVertical: 7`, `paddingHorizontal: 9`, `color: colors.textPrimary`. Mantener `textAlign` como esté hoy.

- [ ] **Step 4: La referencia de la semana pasada baja de peso**

El texto `styles.prevText` ("Última vez (S8): 115kg × 10") pasa a 9px `textMuted` con `letterSpacing: 1`, alineado con la columna de peso (`paddingLeft: 34`), y en mayúsculas: `SEMANA PASADA: 115KG × 10`. El contenido y la condición `entry.prev &&` no cambian.

- [ ] **Step 5: Verificar**

```bash
cd trainer-app && npx tsc --noEmit -p . && npx jest
```

Esperado: sin errores de tipos, 72 tests pasan.

Revisar además que **no quedaron estilos huérfanos** ni referencias a estilos eliminados, y que **todas las funciones siguen presentes**: guardado automático, sugerencia, chips de fecha, historial, video, mapa muscular.

- [ ] **Step 6: Commit**

```bash
git add trainer-app/src/screens/client/WorkoutLogScreen.tsx
git commit -m "feat(app): Registrar ejercicio con el lenguaje de Hoy"
```

---

### Task 5: Inicio

**Files:**
- Modify: `trainer-app/src/screens/client/HomeScreen.tsx`

**Interfaces:**
- Consumes: `<ScreenHeader />`, `<SectionLabel>` (Tarea 1); `<StatHero />`, `<DataRow />` (Tarea 2)
- Produces: nada

- [ ] **Step 1: Leer la pantalla y confirmar que el dato del héroe ya existe**

Leer `trainer-app/src/screens/client/HomeScreen.tsx` (335 líneas). El estado `weekDays` (línea ~40) ya tiene `{ id, day_number, name, total, done }` por día: **el héroe se calcula de ahí, sin ninguna consulta nueva**.

- [ ] **Step 2: Cabecera y héroe de la semana**

Reemplazar el bloque de saludo (`styles.greeting` + `styles.userName`) por la cabecera compartida y el héroe:

```tsx
  const diasCompletos = weekDays.filter(d => d.total > 0 && d.done >= d.total).length;

  // …en el render:
      <ScreenHeader
        left={formatShortDate(new Date().toISOString()).toUpperCase()}
        right={<Text style={styles.weekLabel}>SEMANA {getCurrentWeek()}</Text>}
      />

      {weekDays.length > 0 && (
        <View style={styles.hero}>
          <StatHero
            value={`${diasCompletos}`}
            suffix={`/${weekDays.length}`}
            label="DÍAS ENTRENADOS ESTA SEMANA"
            font="display"
            size={56}
          />
          <View style={styles.dayBars}>
            {weekDays.map(d => (
              <View
                key={d.id}
                style={[styles.dayBar, d.total > 0 && d.done >= d.total && styles.dayBarDone]}
              />
            ))}
          </View>
        </View>
      )}
```

Estilos nuevos:

```tsx
  weekLabel: { fontSize: 9, letterSpacing: 1, fontWeight: '800', color: colors.textMuted },
  hero: { alignItems: 'center', paddingTop: spacing.md, paddingBottom: spacing.sm },
  dayBars: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  dayBar: { width: 26, height: 4, borderRadius: radius.full, backgroundColor: colors.surface },
  dayBarDone: { backgroundColor: colors.accent },
```

Dos imports que hay que agregar en este archivo: `getCurrentWeek` desde `../../lib/weeks` (verifica si ya está en el import existente antes de duplicarlo) y `fonts` al import del tema, que hoy trae solo `colors, spacing, radius, typography`.

- [ ] **Step 3: "Mi semana" pasa a filas**

El bloque `styles.weekCard` (una `Card` con los días en cuadraditos) pasa a `SectionLabel` + una `DataRow` por día:

```tsx
          <SectionLabel style={styles.section}>MI SEMANA</SectionLabel>
          {weekDays.map((d, i) => {
            const completo = d.total > 0 && d.done >= d.total;
            return (
              <DataRow
                key={d.id}
                label={d.name.toUpperCase()}
                value={`${d.done}/${d.total}`}
                state={completo ? 'done' : d.done > 0 ? 'active' : 'idle'}
                index={i}
              />
            );
          })}
```

Conservar el texto resumen (`styles.weekSummary`) debajo, bajándolo a 9px `textMuted`.

- [ ] **Step 4: El ánimo y el split se re-visten**

La tarjeta de ánimo (`styles.moodCard`) pierde la `Card`: queda `SectionLabel` con `¿CÓMO TE SIENTES HOY?` y la fila de botones 1-10 con las cifras en `fonts.mono`, el seleccionado en fondo `accent` con texto `background`. La leyenda y el historial de días anteriores se conservan, en 8px `textMuted`.

La tarjeta de grupos musculares (`styles.groupCard`) pierde la `Card` y su título pasa a `SectionLabel`; su contenido interno no cambia.

- [ ] **Step 5: Verificar**

```bash
cd trainer-app && npx tsc --noEmit -p . && npx jest
```

Esperado: sin errores de tipos, 72 tests pasan. Revisar que no queden estilos huérfanos.

- [ ] **Step 6: Commit**

```bash
git add trainer-app/src/screens/client/HomeScreen.tsx
git commit -m "feat(app): Inicio con héroe de la semana y filas"
```

---

### Task 6: Progreso

**Files:**
- Modify: `trainer-app/src/screens/client/ProgressScreen.tsx`

**Interfaces:**
- Consumes: `<ScreenHeader />`, `<SectionLabel>` (Tarea 1); `<StatHero />`, `<DataRow />` (Tarea 2); `latestRecord(records)` y el tipo `ExerciseRecord` (Tarea 3)
- Produces: nada

- [ ] **Step 1: Leer la pantalla**

Leer `trainer-app/src/screens/client/ProgressScreen.tsx` (585 líneas). Lo que importa para esta tarea:

- `progress` es la lista de ejercicios; cada elemento es un `ExProgress` con `exercise`, `points`, `delta`, `lastWeek` y `best: { weight, reps, week }` (se arma en la línea ~208).
- De `progress` salen cuatro listas filtradas: `improving`, `steady`, `declining` y `noHistory` (líneas ~223-228), más `rows` en la vista por ejercicio.
- `renderRow(p, tone)` (línea ~256) dibuja cada ejercicio como una `Card` con una insignia de variación, y `toneOf(delta)` decide el tono. **Ahí viven el verde y el rojo** (`colors.success` / `colors.danger`, línea ~257).
- `fmtDelta(d)` (línea ~254) ya formatea la variación como `+12%` / `-3%`: reutilízala, no escribas otro formateo.

**El héroe y las filas salen de datos ya calculados, sin consultas nuevas.** Los gráficos (`TrendChart`), el volumen semanal y el cruce energía × rendimiento se conservan tal cual.

- [ ] **Step 2: Héroe del récord más reciente**

Sobre `progress`, elegir el récord y dibujarlo:

```tsx
  const record = latestRecord(
    progress.map(p => ({ name: p.exercise.name, unit: p.exercise.unit, best: p.best })),
  );

  // …en el render, sobre el resumen:
      {record && (
        <View style={styles.hero}>
          <SectionLabel>RÉCORD MÁS RECIENTE · {record.name.toUpperCase()}</SectionLabel>
          <View style={styles.heroStat}>
            <StatHero
              value={`${record.best.weight}`}
              unit={record.unit}
              suffix={`×${record.best.reps}`}
              label={`CONSEGUIDO EN LA SEMANA ${record.best.week}`}
              font="mono"
              size={46}
            />
          </View>
        </View>
      )}
```

Estilos nuevos:

```tsx
  hero: { alignItems: 'center', paddingTop: spacing.md, paddingBottom: spacing.sm },
  heroStat: { marginTop: spacing.xs },
```

El héroe va **solo en la pestaña donde tiene sentido**: la pantalla tiene un selector de pestañas (`segmentText`), así que colócalo donde vive hoy el resumen de "mejorando / manteniendo / por mejorar", no repetido en todas.

- [ ] **Step 3: El resumen pierde su tarjeta y sus colores**

El bloque `styles.summaryCard` (una `Card` con tres `summaryStat` y `summaryDivider`) pasa a una fila con líneas arriba y abajo, sin `Card`:

```tsx
  summaryRow: {
    flexDirection: 'row',
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border,
    marginHorizontal: spacing.xl, marginBottom: spacing.md,
  },
  summaryStat: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm + 2 },
  summaryValue: { fontFamily: fonts.display, fontSize: 22, color: colors.textPrimary },
  summaryLabel: { fontSize: 8, letterSpacing: 1.5, color: colors.textMuted },
  summaryDivider: { width: 1, backgroundColor: colors.border },
```

**Eliminar el `{ color: colors.success }` del contador "MEJORANDO"** y cualquier otro color semántico del resumen: los tres van en `colors.textPrimary`. Ésta es la decisión de monocromo tomada por el dueño.

- [ ] **Step 4: Los ejercicios pasan a filas**

Reescribir `renderRow` para que devuelva una `DataRow` en vez de una `Card`. Recibe además el índice, para que la entrada se escalone:

```tsx
  function renderRow(p: ExProgress, index: number) {
    return (
      <DataRow
        key={p.exercise.id}
        label={p.exercise.name}
        meta={
          p.best.week > 0
            ? `MEJOR ${p.best.weight}${p.exercise.unit} × ${p.best.reps} · S${p.best.week}`
            : 'SIN REGISTROS'
        }
        value={p.delta != null ? fmtDelta(p.delta) : '—'}
        index={index}
      />
    );
  }
```

Actualizar los cuatro sitios que la llaman (líneas ~446, ~461, ~471, ~481) para que pasen el índice del `map` en vez del tono:

```tsx
                    {rows.map((p, i) => renderRow(p, i))}
```

y lo mismo para `improving`, `declining` y `steady`.

**El signo es lo único que distingue mejora de retroceso** — sin verde ni rojo, y sin las flechas de tendencia. Con eso quedan sin uso `toneOf`, `styles.deltaBadge`, `styles.deltaText`, `styles.exRow`, `styles.exRowHeader`, `styles.exRowInfo`, `styles.exRowName` y `styles.exRowMeta`: elimínalos si efectivamente ya nadie los usa. Ojo con `toneOf` y el tipo `Tone`, que también se importan/usan en otras partes del archivo — comprueba antes de borrar.

Los gráficos de tendencia y el bloque de energía × rendimiento **se conservan**; sus títulos pasan a `SectionLabel`.

- [ ] **Step 5: Verificar**

```bash
cd trainer-app && npx tsc --noEmit -p . && npx jest
```

Esperado: sin errores de tipos, 72 tests pasan.

Comprobar además que no quede ningún color semántico en la pantalla:

```bash
grep -n "colors.success\|colors.danger\|colors.warning\|#[0-9a-fA-F]\{6\}" src/screens/client/ProgressScreen.tsx
```

Esperado: sin salida, salvo que aparezca el `#FFFFFF` del estado activo de `DataRow` (que vive en el componente, no acá).

- [ ] **Step 6: Commit**

```bash
git add trainer-app/src/screens/client/ProgressScreen.tsx
git commit -m "feat(app): Progreso con récord héroe, filas y sin colores semánticos"
```

---

### Task 7: Verificación en dispositivo

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Verificación local**

```bash
cd trainer-app && npx jest && npx tsc --noEmit -p .
```

Esperado: 72 tests, sin errores de tipos.

- [ ] **Step 2: Confirmar el alcance y el monocromo**

```bash
cd /Users/sebastianazocarmondaca/Desktop/APP_trainer
git diff --stat feat/hoy-estetica -- web/ trainer-app/src/screens/coach/ trainer-app/src/theme/
grep -rn "colors.warning" trainer-app/src/screens/client/
```

Esperado: el primero **sin salida** (ni la web, ni la app del coach, ni el tema cambiaron); el segundo **sin salida** (el ámbar no se usa en ninguna pantalla del alumno).

- [ ] **Step 3: Build de TestFlight**

El coordinador lanza `npx eas-cli build --platform ios --profile production --non-interactive --auto-submit` y avisa al dueño que la compilación debe agregarse a mano al grupo "Coaches Beta" en App Store Connect.

- [ ] **Step 4: Casos a mirar en el teléfono**

Con una cuenta de alumno con varias semanas registradas y otra recién empezando:

1. **Registrar ejercicio** — el peso de referencia domina; la serie en curso resalta en blanco; las guardadas se atenúan; el guardado automático sigue funcionando (salir y volver a entrar conserva lo escrito).
2. **Registrar ejercicio, sin peso de referencia** — el héroe muestra `—` y no rompe el diseño.
3. **Inicio** — el conteo de días coincide con lo que dice "Hoy"; las barras marcan los días completos.
4. **Inicio, alumno sin plan** — no aparece el héroe y la pantalla no queda rota.
5. **Progreso** — el récord héroe es el más reciente y coincide con la lista de abajo; ningún verde ni rojo.
6. **Progreso, alumno sin registros** — el estado vacío se mantiene, sin héroe.
7. Con **"Reducir movimiento"** activado: todo aparece completo, sin animación.

---

## Fuera de alcance (explícito)

- Las cuatro pantallas re-vestidas (`CoachProfileScreen`, `HistoryScreen`, `SessionDetailScreen`, `BodyProgressScreen`): son la Parte 2, con su propio plan.
- Toda la app del coach y la web.
- Modificar `ExerciseRow` o `TodayScreen`, que ya están verificados.
- Cambiar cualquier token del tema.
- Cualquier cambio de datos, consultas o lógica de negocio.
