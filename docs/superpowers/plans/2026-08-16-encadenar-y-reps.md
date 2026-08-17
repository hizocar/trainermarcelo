# Encadenar ejercicios y objetivo de reps libre — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el coach arme biseries y triseries con un toque entre dos ejercicios, y que pueda escribir cualquier rango de repeticiones en vez de elegir de una lista fija.

**Architecture:** Toda la decisión de qué queda agrupado con qué vive en funciones puras con tests (`lib/superseries.ts`); las dos pantallas de edición solo las llaman y persisten el resultado. Ninguna función reordena la lista: encadenar une vecinos, así que `order_index` no se toca.

**Tech Stack:** React Native / Expo SDK 54, RN 0.81.5, Supabase, Jest.

## Global Constraints

- **Rama:** trabajar en `feat/encadenar-y-reps`, creada **desde `feat/armonia-alumno`** (no desde `sandbox`). **NUNCA commitear ni pushear a `sandbox`** — despliega automáticamente a producción, donde hay seis coaches beta y sus alumnos usando el producto.
- **Solo se toca `trainer-app/`.** No se modifica `web/`, ni las pantallas del alumno (`src/screens/client/`), ni `groupBySuperseries` en `src/lib/plan.ts`.
- **Sin migraciones de base de datos.** `reps_objective` sigue siendo `text` con formato `"desde-hasta"`; `superseries_group` sigue siendo `text`.
- **`order_index` no se toca.** Encadenar une vecinos y no mueve ejercicios. Si algo parece exigir reordenar, PARAR y reportarlo: mover ejercicios cambia qué entrena el alumno y en qué orden.
- **Los planes existentes siguen funcionando.** Las superseries viejas tienen etiquetas escritas a mano ("Superserie 1"): se muestran agrupadas y se pueden disolver, y **no se reescriben solas**.
- **El tema no se modifica.** La paleta de colores de superserie vive en `lib/superseries.ts`, no en el tema: no es parte del sistema de color de la app, es una ayuda de autoría para el coach. El ámbar `colors.warning` sigue reservado para "esto requiere que el coach haga algo" y no se usa para esto.
- **Los controles táctiles cumplen 44pt de alto real.** En React Native el padding del contenedor padre **no** amplía el área táctil del hijo. Este proyecto ya acumuló seis hallazgos de este tipo.
- **Idioma:** UI y comentarios en español de Chile.
- **Commits:** uno por tarea, en español (`feat:` / `fix:` / `refactor:`).
- Los **73 tests** existentes de `trainer-app/` deben seguir pasando y `npx tsc --noEmit -p .` quedar limpio en cada tarea.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `trainer-app/src/lib/reps.ts` | **crear** — leer y escribir el rango `"8-12"` desde dos campos |
| `trainer-app/src/lib/__tests__/reps.test.ts` | **crear** — tests del rango |
| `trainer-app/src/lib/superseries.ts` | **crear** — encadenar, desencadenar, letras y colores |
| `trainer-app/src/lib/__tests__/superseries.test.ts` | **crear** — tests de agrupación |
| `trainer-app/src/screens/coach/PlanEditorScreen.tsx` | **modificar** — control de cadena + campos de reps |
| `trainer-app/src/screens/coach/ProgramEditorScreen.tsx` | **modificar** — lo mismo, en el editor de programas |

Las dos pantallas duplican hoy la misma lógica (`REPS_OPTIONS` está definido idéntico en ambas). El módulo compartido es lo que evita escribir el encadenado dos veces y equivocarse en una.

---

### Task 1: El rango de repeticiones

Lógica pura para convertir entre el string que guarda la base (`"8-12"`) y los dos campos que ve el coach.

**Files:**
- Create: `trainer-app/src/lib/reps.ts`
- Test: `trainer-app/src/lib/__tests__/reps.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `parseRepsRange(value?: string | null): { from: string; to: string }`
  - `formatRepsRange(from: string, to: string): string`
  - `DEFAULT_REPS = '8-12'`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `trainer-app/src/lib/__tests__/reps.test.ts`:

```ts
import { parseRepsRange, formatRepsRange, DEFAULT_REPS } from '../reps';

describe('parseRepsRange', () => {
  it('separa un rango en sus dos extremos', () => {
    expect(parseRepsRange('8-12')).toEqual({ from: '8', to: '12' });
  });

  it('tolera espacios alrededor del guion', () => {
    expect(parseRepsRange('10 - 15')).toEqual({ from: '10', to: '15' });
  });

  it('un número solo llena únicamente "desde"', () => {
    expect(parseRepsRange('10')).toEqual({ from: '10', to: '' });
  });

  it('sin valor devuelve ambos campos vacíos', () => {
    expect(parseRepsRange(null)).toEqual({ from: '', to: '' });
    expect(parseRepsRange(undefined)).toEqual({ from: '', to: '' });
    expect(parseRepsRange('')).toEqual({ from: '', to: '' });
  });

  it('un texto viejo que no es un rango no revienta: queda en "desde"', () => {
    // hay planes con textos escritos a mano antes de este cambio
    expect(parseRepsRange('al fallo')).toEqual({ from: 'al fallo', to: '' });
  });
});

describe('formatRepsRange', () => {
  it('une los dos extremos con un guion', () => {
    expect(formatRepsRange('7', '9')).toBe('7-9');
  });

  it('solo "desde" guarda un objetivo fijo', () => {
    expect(formatRepsRange('10', '')).toBe('10');
  });

  it('ambos vacíos caen al valor por omisión', () => {
    expect(formatRepsRange('', '')).toBe(DEFAULT_REPS);
  });

  it('solo "hasta" se trata como objetivo fijo, no como rango a medias', () => {
    expect(formatRepsRange('', '12')).toBe('12');
  });

  it('ignora espacios que el coach haya tecleado', () => {
    expect(formatRepsRange(' 8 ', ' 12 ')).toBe('8-12');
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

```bash
cd trainer-app && npx jest src/lib/__tests__/reps.test.ts
```

Esperado: FALLA — no existe el módulo `../reps`.

- [ ] **Step 3: Implementar**

Crear `trainer-app/src/lib/reps.ts`:

```ts
// El objetivo de repeticiones se guarda como texto ("8-12") desde antes de que
// existiera este módulo, y `repTopOf` en progress.ts lee de ahí el tope del
// rango para sugerir subidas de peso. Por eso el coach escribe dos números y
// nosotros armamos el mismo formato de siempre: sin migración, y la
// autoprogresión sigue funcionando.

/** Lo que usa la base cuando el coach no especifica nada. */
export const DEFAULT_REPS = '8-12';

/** Separa "8-12" en los dos campos del formulario. */
export function parseRepsRange(value?: string | null): { from: string; to: string } {
  if (!value) return { from: '', to: '' };
  const rango = value.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
  if (rango) return { from: rango[1], to: rango[2] };
  // un número solo, o un texto viejo escrito a mano: se muestra tal cual en
  // "desde" para no perderlo al editar
  return { from: value.trim(), to: '' };
}

/** Arma el string que se guarda, desde los dos campos. */
export function formatRepsRange(from: string, to: string): string {
  const desde = from.trim();
  const hasta = to.trim();
  if (desde && hasta) return `${desde}-${hasta}`;
  if (desde) return desde;
  if (hasta) return hasta;
  return DEFAULT_REPS;
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

```bash
cd trainer-app && npx jest && npx tsc --noEmit -p .
```

Esperado: 83 tests pasan (73 + 10 nuevos), sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add trainer-app/src/lib/reps.ts trainer-app/src/lib/__tests__/reps.test.ts
git commit -m "feat(app): leer y escribir el rango de reps desde dos campos"
```

---

### Task 2: La lógica de encadenado

El corazón del trabajo. Ninguna de estas funciones reordena la lista: todas devuelven los mismos ejercicios en el mismo orden, cambiando solo `superseries_group`.

**Files:**
- Create: `trainer-app/src/lib/superseries.ts`
- Test: `trainer-app/src/lib/__tests__/superseries.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - el tipo `Chainable = { id: string; superseries_group: string | null }`
  - `nextGroupLabel(existing: (string | null)[]): string`
  - `chainWith<T extends Chainable>(exercises: T[], exerciseId: string): T[]`
  - `unchain<T extends Chainable>(exercises: T[], exerciseId: string): T[]`
  - `dissolveGroup<T extends Chainable>(exercises: T[], label: string): T[]`
  - `groupNameFor(count: number, label: string): string`
  - `colorForLabel(label: string): string`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `trainer-app/src/lib/__tests__/superseries.test.ts`:

```ts
import {
  nextGroupLabel, chainWith, unchain, dissolveGroup, groupNameFor, colorForLabel,
} from '../superseries';

const ej = (id: string, g: string | null = null) => ({ id, superseries_group: g });

describe('nextGroupLabel', () => {
  it('sin grupos empieza en A', () => {
    expect(nextGroupLabel([null, null])).toBe('A');
  });

  it('con A usada sigue B', () => {
    expect(nextGroupLabel(['A', 'A', null])).toBe('B');
  });

  it('con A y C usadas rellena el hueco: B', () => {
    expect(nextGroupLabel(['A', 'C'])).toBe('B');
  });

  it('las etiquetas viejas escritas a mano no ocupan letras', () => {
    // planes hechos antes de este cambio tienen cosas como "Superserie 1"
    expect(nextGroupLabel(['Superserie 1', null])).toBe('A');
  });
});

describe('chainWith', () => {
  it('une un ejercicio con el de arriba creando el grupo A', () => {
    const lista = [ej('1'), ej('2'), ej('3')];
    expect(chainWith(lista, '2')).toEqual([
      ej('1', 'A'), ej('2', 'A'), ej('3'),
    ]);
  });

  it('encadenar al siguiente convierte la biserie en triserie, sin letra nueva', () => {
    const lista = [ej('1', 'A'), ej('2', 'A'), ej('3')];
    expect(chainWith(lista, '3')).toEqual([
      ej('1', 'A'), ej('2', 'A'), ej('3', 'A'),
    ]);
  });

  it('un grupo nuevo bajo uno existente toma la letra siguiente', () => {
    const lista = [ej('1', 'A'), ej('2', 'A'), ej('3'), ej('4')];
    expect(chainWith(lista, '4')).toEqual([
      ej('1', 'A'), ej('2', 'A'), ej('3', 'B'), ej('4', 'B'),
    ]);
  });

  it('el primero de la lista no tiene con quién encadenarse: no cambia nada', () => {
    const lista = [ej('1'), ej('2')];
    expect(chainWith(lista, '1')).toEqual(lista);
  });

  it('un id que no está en la lista no cambia nada', () => {
    const lista = [ej('1'), ej('2')];
    expect(chainWith(lista, 'fantasma')).toEqual(lista);
  });

  it('no altera el orden de la lista', () => {
    const lista = [ej('1'), ej('2'), ej('3')];
    expect(chainWith(lista, '2').map(e => e.id)).toEqual(['1', '2', '3']);
  });
});

describe('unchain', () => {
  it('sacar uno de una biserie disuelve el grupo entero', () => {
    // el que queda solo deja de ser superserie: un grupo de uno no es un grupo
    const lista = [ej('1', 'A'), ej('2', 'A'), ej('3')];
    expect(unchain(lista, '2')).toEqual([ej('1'), ej('2'), ej('3')]);
  });

  it('sacar uno de una triserie la deja como biserie', () => {
    const lista = [ej('1', 'A'), ej('2', 'A'), ej('3', 'A')];
    expect(unchain(lista, '3')).toEqual([
      ej('1', 'A'), ej('2', 'A'), ej('3'),
    ]);
  });

  it('sacar un ejercicio sin grupo no cambia nada', () => {
    const lista = [ej('1'), ej('2')];
    expect(unchain(lista, '1')).toEqual(lista);
  });
});

describe('dissolveGroup', () => {
  it('deshace el grupo completo y deja el resto intacto', () => {
    const lista = [ej('1', 'A'), ej('2', 'A'), ej('3', 'B'), ej('4', 'B')];
    expect(dissolveGroup(lista, 'A')).toEqual([
      ej('1'), ej('2'), ej('3', 'B'), ej('4', 'B'),
    ]);
  });

  it('sirve para las etiquetas viejas escritas a mano', () => {
    const lista = [ej('1', 'Superserie 1'), ej('2', 'Superserie 1')];
    expect(dissolveGroup(lista, 'Superserie 1')).toEqual([ej('1'), ej('2')]);
  });
});

describe('groupNameFor', () => {
  it('dos ejercicios son una biserie', () => {
    expect(groupNameFor(2, 'A')).toBe('BISERIE A');
  });

  it('tres son una triserie', () => {
    expect(groupNameFor(3, 'A')).toBe('TRISERIE A');
  });

  it('cuatro o más son una superserie', () => {
    expect(groupNameFor(4, 'B')).toBe('SUPERSERIE B');
  });
});

describe('colorForLabel', () => {
  it('la misma etiqueta da siempre el mismo color', () => {
    expect(colorForLabel('A')).toBe(colorForLabel('A'));
  });

  it('etiquetas distintas dan colores distintos', () => {
    expect(colorForLabel('A')).not.toBe(colorForLabel('B'));
  });

  it('una etiqueta vieja escrita a mano también recibe color', () => {
    expect(typeof colorForLabel('Superserie 1')).toBe('string');
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

```bash
cd trainer-app && npx jest src/lib/__tests__/superseries.test.ts
```

Esperado: FALLA — no existe el módulo `../superseries`.

- [ ] **Step 3: Implementar**

Crear `trainer-app/src/lib/superseries.ts`:

```ts
// Encadenar ejercicios en biseries y triseries, para el editor del coach.
//
// Regla de oro: ninguna función de acá reordena la lista. `groupBySuperseries`
// (en plan.ts) solo agrupa ejercicios CONSECUTIVOS, y por eso encadenar es
// siempre "unir con el de arriba": la adyacencia queda garantizada sin tocar
// `order_index`, que es lo que determina qué entrena el alumno y en qué orden.

export interface Chainable {
  id: string;
  superseries_group: string | null;
}

/** Las letras que se asignan solas, en orden. */
const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/**
 * Colores de autoría, solo para el editor del coach.
 *
 * No viven en el tema a propósito: la app es monocroma y estos colores no son
 * parte de su sistema visual. Son una ayuda para escanear agrupaciones
 * mientras se arma el plan. El alumno ve las mismas superseries en gris.
 */
const COLORES = ['#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#22c55e', '#ef4444'];

/**
 * La próxima letra libre del día.
 *
 * Las etiquetas viejas escritas a mano ("Superserie 1") no ocupan letra: son
 * de planes anteriores a este cambio y conviven sin estorbar.
 */
export function nextGroupLabel(existing: (string | null)[]): string {
  const usadas = new Set(existing.filter((e): e is string => !!e));
  return LETRAS.find(l => !usadas.has(l)) ?? LETRAS[0];
}

/** Une el ejercicio con el de arriba. Si el de arriba ya tiene grupo, se suma a él. */
export function chainWith<T extends Chainable>(exercises: T[], exerciseId: string): T[] {
  const i = exercises.findIndex(e => e.id === exerciseId);
  if (i <= 0) return exercises; // el primero no tiene con quién encadenarse
  const anterior = exercises[i - 1];
  const label = anterior.superseries_group
    ?? nextGroupLabel(exercises.map(e => e.superseries_group));
  return exercises.map((e, idx) =>
    idx === i || idx === i - 1 ? { ...e, superseries_group: label } : e,
  );
}

/** Saca un ejercicio de su grupo; si el grupo queda de uno, lo disuelve. */
export function unchain<T extends Chainable>(exercises: T[], exerciseId: string): T[] {
  const objetivo = exercises.find(e => e.id === exerciseId);
  const label = objetivo?.superseries_group;
  if (!label) return exercises;
  const sinEl = exercises.map(e =>
    e.id === exerciseId ? { ...e, superseries_group: null } : e,
  );
  const quedan = sinEl.filter(e => e.superseries_group === label).length;
  return quedan >= 2 ? sinEl : dissolveGroup(sinEl, label);
}

/** Deshace un grupo completo. */
export function dissolveGroup<T extends Chainable>(exercises: T[], label: string): T[] {
  return exercises.map(e =>
    e.superseries_group === label ? { ...e, superseries_group: null } : e,
  );
}

/** Cómo se llama un grupo según cuántos ejercicios tenga. */
export function groupNameFor(count: number, label: string): string {
  if (count === 2) return `BISERIE ${label}`;
  if (count === 3) return `TRISERIE ${label}`;
  return `SUPERSERIE ${label}`;
}

/** El color de un grupo. Estable para la misma etiqueta. */
export function colorForLabel(label: string): string {
  let suma = 0;
  for (let i = 0; i < label.length; i++) suma += label.charCodeAt(i);
  return COLORES[suma % COLORES.length];
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

```bash
cd trainer-app && npx jest && npx tsc --noEmit -p .
```

Esperado: 104 tests pasan (83 + 21 nuevos), sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add trainer-app/src/lib/superseries.ts trainer-app/src/lib/__tests__/superseries.test.ts
git commit -m "feat(app): lógica de encadenado de ejercicios, sin tocar el orden"
```

---

### Task 3: Encadenar y reps en el editor del plan

**Files:**
- Modify: `trainer-app/src/screens/coach/PlanEditorScreen.tsx`

**Interfaces:**
- Consumes: `parseRepsRange`, `formatRepsRange`, `DEFAULT_REPS` (Tarea 1); `chainWith`, `unchain`, `dissolveGroup`, `groupNameFor`, `colorForLabel` (Tarea 2)
- Produces: nada

- [ ] **Step 1: Leer la pantalla antes de tocarla**

Leer `trainer-app/src/screens/coach/PlanEditorScreen.tsx` (1.116 líneas). **Es el archivo más frágil del proyecto.** Lo que importa para esta tarea:

- `days` es el estado, con `days[].exercises[]`; cada ejercicio tiene `id`, `name`, `superseries_group`, `reps_objective`, `unit`, `ref_weight`.
- `moveExercise(dayId, index, dir)` (busca esa función) muestra el patrón de persistencia de esta pantalla: actualiza el estado local con `setDays` y **después** persiste con `supabase.from('exercises').update(...)`. Sigue ese mismo patrón.
- El modal de ejercicio usa `exReps` (línea ~56), `exSuperseries` (~59), y guarda en dos sitios: alta (~408) y edición (~356).
- `REPS_OPTIONS` (línea 18) y los chips (~739) son lo que se reemplaza.

**No toques** `order_index`, ni `moveExercise`, ni la lógica de guardado de media.

- [ ] **Step 2: El control de cadena entre ejercicios**

Dentro de `day.exercises.map((ex, idx) => ...)` (línea ~516), antes de la `Card` de cada ejercicio, dibujar el control cuando corresponda:

```tsx
              {(() => {
                if (idx === 0) return null;
                const anterior = day.exercises[idx - 1];
                const mismoGrupo =
                  !!ex.superseries_group && ex.superseries_group === anterior.superseries_group;
                if (mismoGrupo) return null;
                return (
                  <TouchableOpacity
                    style={styles.chainBtn}
                    onPress={() => chainExercise(day.id, ex.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 20, right: 20 }}
                  >
                    <View style={styles.chainLine} />
                    <Text style={styles.chainText}>⛓ UNIR</Text>
                    <View style={styles.chainLine} />
                  </TouchableOpacity>
                );
              })()}
```

Estilos nuevos:

```tsx
  chainBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    minHeight: 44, paddingHorizontal: spacing.md,
  },
  chainLine: { flex: 1, height: 1, backgroundColor: colors.border },
  chainText: { fontSize: 9, letterSpacing: 1.5, fontWeight: '800', color: colors.textMuted },
```

El `minHeight: 44` va en el propio `TouchableOpacity` a propósito: el padding del contenedor padre no amplía el área táctil de un hijo en React Native.

- [ ] **Step 3: Persistir el encadenado**

Agregar junto a `moveExercise`, siguiendo su mismo patrón —estado primero, base después—:

```tsx
  // Encadenar no reordena: solo cambia `superseries_group` de los ejercicios
  // afectados. Por eso acá nunca se toca `order_index`.
  async function persistGroups(dayId: string, antes: Exercise[], despues: Exercise[]) {
    const cambiados = despues.filter((e, i) => e.superseries_group !== antes[i].superseries_group);
    setDays(prev => prev.map(d => (d.id === dayId ? { ...d, exercises: despues } : d)));
    for (const e of cambiados) {
      const { error } = await supabase
        .from('exercises')
        .update({ superseries_group: e.superseries_group })
        .eq('id', e.id);
      if (error) {
        showAlert('Error', 'No se pudo guardar la agrupación: ' + error.message);
        return;
      }
    }
  }

  function chainExercise(dayId: string, exerciseId: string) {
    const day = days.find(d => d.id === dayId);
    if (!day) return;
    persistGroups(dayId, day.exercises, chainWith(day.exercises, exerciseId));
  }

  function unchainExercise(dayId: string, exerciseId: string) {
    const day = days.find(d => d.id === dayId);
    if (!day) return;
    persistGroups(dayId, day.exercises, unchain(day.exercises, exerciseId));
  }

  function dissolveExerciseGroup(dayId: string, label: string) {
    const day = days.find(d => d.id === dayId);
    if (!day) return;
    persistGroups(dayId, day.exercises, dissolveGroup(day.exercises, label));
  }
```

`Exercise` es el tipo que esta pantalla ya usa (`DayWithExercises`, línea 32) y ya está importado. **No tragues el `error`**: un error silenciado acá le muestra al coach una agrupación que no quedó guardada.

- [ ] **Step 4: Mostrar el grupo con su color**

La etiqueta actual (línea ~541) es `<Text style={styles.superTag}>⛓ {ex.superseries_group}</Text>` dentro de `styles.exInfo`. Reemplazarla por una etiqueta con color y sus dos formas de deshacer:

```tsx
                    {ex.superseries_group && (
                      <View style={styles.superRow}>
                        {/* tocar la etiqueta deshace el grupo entero; "SACAR"
                            saca solo este ejercicio */}
                        <TouchableOpacity
                          onPress={() => dissolveExerciseGroup(day.id, ex.superseries_group!)}
                          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                          style={[
                            styles.superTag,
                            { backgroundColor: colorForLabel(ex.superseries_group) },
                          ]}
                        >
                          <Text style={styles.superTagText}>
                            ⛓ {groupNameFor(
                              day.exercises.filter(e => e.superseries_group === ex.superseries_group).length,
                              ex.superseries_group,
                            )} ✕
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => unchainExercise(day.id, ex.id)}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                          <Text style={styles.superUnchain}>SACAR</Text>
                        </TouchableOpacity>
                      </View>
                    )}
```

Además, dar borde de color a la tarjeta del ejercicio agrupado: donde hoy se renderiza `<Card style={styles.exCard}>` (o equivalente), agregar cuando haya grupo `{ borderColor: colorForLabel(ex.superseries_group), borderWidth: 1.5 }`.

Estilos nuevos (reemplazan el `superTag` de texto plano, que se elimina):

```tsx
  superRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 3 },
  superTag: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  superTagText: { fontSize: 8, fontWeight: '900', letterSpacing: 1, color: colors.background },
  superUnchain: { fontSize: 8, fontWeight: '800', letterSpacing: 1, color: colors.textMuted },
```

- [ ] **Step 5: Los dos campos de reps**

Reemplazar el `ScrollView` de chips (línea ~739) por dos campos numéricos:

```tsx
            <Text style={styles.inputLabel}>OBJETIVO DE REPS</Text>
            <View style={styles.repsRow}>
              <TextInput
                style={styles.repsInput}
                value={exRepsFrom}
                onChangeText={setExRepsFrom}
                keyboardType="number-pad"
                placeholder="desde"
                placeholderTextColor={colors.textMuted}
                maxLength={3}
              />
              <Text style={styles.repsDash}>a</Text>
              <TextInput
                style={styles.repsInput}
                value={exRepsTo}
                onChangeText={setExRepsTo}
                keyboardType="number-pad"
                placeholder="hasta"
                placeholderTextColor={colors.textMuted}
                maxLength={3}
              />
            </View>
```

Estilos nuevos (reemplazan `repsPicker`, `repsOption`, `repsOptionActive`, `repsOptionText`, `repsOptionTextActive`, que se eliminan junto con la constante `REPS_OPTIONS`):

```tsx
  repsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  repsInput: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.md,
    paddingVertical: spacing.md - 4, paddingHorizontal: spacing.md,
    fontSize: 15, color: colors.textPrimary, textAlign: 'center',
  },
  repsDash: { fontSize: 11, color: colors.textMuted },
```

Cambiar el estado: donde hoy está `const [exReps, setExReps] = useState('8-12')`, poner dos:

```tsx
  const [exRepsFrom, setExRepsFrom] = useState('');
  const [exRepsTo, setExRepsTo] = useState('');
```

Al abrir para editar (línea ~213, hoy `setExReps(ex.reps_objective)`):

```tsx
    const rango = parseRepsRange(ex.reps_objective);
    setExRepsFrom(rango.from);
    setExRepsTo(rango.to);
```

Al limpiar el formulario (línea ~194): `setExRepsFrom(''); setExRepsTo('');`

Y en los dos guardados (alta ~408 y edición ~356), donde hoy va `reps_objective: exReps`:

```tsx
        reps_objective: formatRepsRange(exRepsFrom, exRepsTo),
```

- [ ] **Step 6: Quitar el campo de texto de superserie**

El bloque "GRUPO / SUPERSERIE (opcional)" (línea ~717) se elimina del modal, junto con el estado `exSuperseries` / `setExSuperseries` y sus usos. En los dos guardados, **quitar** la línea `superseries_group: exSuperseries.trim() || null`:

- en la **edición** (~356), quitarla sin reemplazo — la agrupación ahora se maneja desde la lista y no debe pisarse al editar otros campos;
- en el **alta** (~408), dejarla explícitamente en `superseries_group: null` — un ejercicio recién agregado nace suelto y se encadena después.

Este segundo punto es importante: si se omite el campo en el `insert`, la columna toma su valor por omisión, y hay que asegurarse de que sea `null`.

- [ ] **Step 7: Verificar**

```bash
cd trainer-app && npx tsc --noEmit -p . && npx jest
```

Esperado: sin errores de tipos, 104 tests pasan.

Comprobar además que no quedaron restos:

```bash
grep -n "REPS_OPTIONS\|exSuperseries\|repsOption" src/screens/coach/PlanEditorScreen.tsx
```

Esperado: sin salida.

- [ ] **Step 8: Commit**

```bash
git add trainer-app/src/screens/coach/PlanEditorScreen.tsx
git commit -m "feat(app): encadenar ejercicios y rango de reps libre en el editor de plan"
```

---

### Task 4: Lo mismo en el editor de programas

`ProgramEditorScreen` duplica la lógica de `PlanEditorScreen`. Si solo se arregla uno, el coach tiene dos editores que se comportan distinto según desde dónde entró.

**Files:**
- Modify: `trainer-app/src/screens/coach/ProgramEditorScreen.tsx`

**Interfaces:**
- Consumes: `parseRepsRange`, `formatRepsRange` (Tarea 1); `chainWith`, `unchain`, `dissolveGroup`, `groupNameFor`, `colorForLabel` (Tarea 2)
- Produces: nada

- [ ] **Step 1: Leer las dos pantallas**

Leer `trainer-app/src/screens/coach/ProgramEditorScreen.tsx` (739 líneas) y, como referencia de lo que ya quedó hecho, `trainer-app/src/screens/coach/PlanEditorScreen.tsx`. **No modifiques `PlanEditorScreen`**: ya está terminada y revisada.

**Diferencia que importa:** en `ProgramEditorScreen` el recorrido de ejercicios es `day.exercises.map(ex => {` (línea ~397), **sin índice**. El control de cadena necesita saber cuál es el ejercicio anterior, así que hay que pasar a `map((ex, idx) => {`.

Otra diferencia: los ejercicios de un programa viven en la tabla de plantillas, no en `exercises`. Usa la tabla y la forma de persistir que **esa** pantalla ya emplea para editar un ejercicio; no copies la consulta de `PlanEditorScreen`.

- [ ] **Step 2: Aplicar los mismos cambios**

Repetir en esta pantalla lo hecho en la Tarea 3:

1. el control `⛓ UNIR` entre ejercicios, con `minHeight: 44` en el propio `TouchableOpacity`;
2. las funciones `chainExercise` / `unchainExercise` / `dissolveExerciseGroup`, que llaman a las funciones puras y persisten con el patrón de esta pantalla, **sin tragar el `error`**;
3. la etiqueta de grupo con color y el botón "SACAR";
4. los dos campos numéricos de reps, con `parseRepsRange` al abrir y `formatRepsRange` al guardar;
5. la eliminación del campo de texto de superserie, del estado `exSuperseries` y de la constante `REPS_OPTIONS`.

Los estilos son los mismos que en la Tarea 3: `chainBtn`, `chainLine`, `chainText`, `superRow`, `superTag`, `superTagText`, `superUnchain`, `repsRow`, `repsInput`, `repsDash`. Cópialos con los mismos valores para que las dos pantallas se vean iguales.

- [ ] **Step 3: Verificar**

```bash
cd trainer-app && npx tsc --noEmit -p . && npx jest
```

Esperado: sin errores de tipos, 104 tests pasan.

```bash
grep -rn "REPS_OPTIONS\|exSuperseries" src/screens/coach/
```

Esperado: sin salida en ninguna de las dos pantallas.

- [ ] **Step 4: Commit**

```bash
git add trainer-app/src/screens/coach/ProgramEditorScreen.tsx
git commit -m "feat(app): encadenar ejercicios y rango de reps libre en el editor de programas"
```

---

### Task 5: Verificación en dispositivo

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Verificación local**

```bash
cd trainer-app && npx jest && npx tsc --noEmit -p .
```

Esperado: 104 tests, sin errores de tipos.

- [ ] **Step 2: Confirmar el alcance**

```bash
cd /Users/sebastianazocarmondaca/Desktop/APP_trainer
git diff --stat feat/armonia-alumno -- web/ trainer-app/src/screens/client/ trainer-app/src/theme/ trainer-app/src/lib/plan.ts
```

Esperado: **sin salida** — ni la web, ni las pantallas del alumno, ni el tema, ni `groupBySuperseries` cambiaron.

- [ ] **Step 3: Build de TestFlight**

El coordinador lanza `npx eas-cli build --platform ios --profile production --non-interactive --auto-submit` y avisa al dueño que la compilación debe agregarse a mano al grupo "Coaches Beta" en App Store Connect.

- [ ] **Step 4: Casos a mirar en el teléfono**

Con una cuenta de coach y un alumno de prueba:

1. **Encadenar dos ejercicios sueltos** — nace `BISERIE A` con color, y el borde de ambas tarjetas toma ese color.
2. **Encadenar el siguiente** — pasa a `TRISERIE A` sola, sin crear letra nueva.
3. **Crear un segundo grupo** más abajo — recibe `B`, con otro color.
4. **"SACAR" en un ejercicio de una biserie** — el grupo desaparece completo, porque el que queda ya no es un grupo.
5. **"SACAR" en uno de una triserie** — queda biserie, y la etiqueta cambia de nombre sola.
6. **Abrir la app del alumno** en esa semana y confirmar que la biserie **se ve agrupada**. Éste es el caso que importa: si acá falla, la agrupación no está llegando.
7. **Un plan viejo con "Superserie 1"** escrito a mano — se sigue viendo agrupado y se puede sacar.
8. **Editar un ejercicio existente** — sus reps se cargan en los dos campos.
9. **Guardar 7 a 9** y confirmar que la sugerencia de subir peso lo respeta (completar el tope del rango durante una semana).
10. **Guardar dejando los dos campos vacíos** — queda `8-12`.
11. Repetir 1, 4 y 8 en el **editor de programas**.

---

## Fuera de alcance (explícito)

- Renombrar automáticamente las superseries viejas escritas a mano: conviven con las nuevas.
- Encadenar ejercicios que no estén adyacentes: el coach los junta antes con las flechas que ya existen.
- La app del alumno, la web y `groupBySuperseries`.
- Cambiar el formato de `reps_objective` o de `superseries_group` en la base.
- Cualquier cambio en `order_index`.
