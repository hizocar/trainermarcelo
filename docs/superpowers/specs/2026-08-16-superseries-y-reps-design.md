# Superseries por selección y objetivo de reps libre (app del coach) — Diseño

**Fecha:** 2026-08-16
**Estado:** aprobado por el dueño del producto

## Problema

Dos fricciones en el editor de día del coach, reportadas con capturas:

1. **Armar una superserie es un acto de fe.** El campo se llama "GRUPO / SUPERSERIE (opcional)" y es texto libre: el coach escribe "Superserie 1" en un ejercicio y tiene que acordarse de escribir exactamente lo mismo en el otro. No hay forma de seleccionar dos ejercicios y decir "estos van juntos", ni se ve de un vistazo qué está agrupado con qué.
2. **El objetivo de reps está encajonado.** Es una lista de chips fijos (`4-6`, `6-8`, `8-10`, `8-12`, `10-12`, `12-15`, `10-15`). Si el coach quiere 7-9 o 15-20, no puede.

## Un detalle del que depende todo lo demás

`groupBySuperseries` (en `trainer-app/src/lib/plan.ts`) agrupa **solo ejercicios consecutivos** con la misma etiqueta. Si el coach marca el ejercicio 1 y el 4 como superserie A sin moverlos, el alumno **no** ve una superserie: ve dos grupos sueltos de uno.

Por eso agrupar implica **reordenar**, y no es un detalle de implementación: es la razón por la que la función de agrupar tiene que mover ejercicios.

## Decisiones tomadas

| Decisión | Elección | Descartado |
|---|---|---|
| Al agrupar no consecutivos | Reordenar automáticamente, en el orden en que se seleccionaron | Avisar y que el coach los mueva; permitir agrupar solo adyacentes |
| Objetivo de reps | Dos campos numéricos, "desde" y "hasta" | Un campo de texto totalmente libre; "hasta" opcional |
| Alcance | Los dos editores: `PlanEditorScreen` y `ProgramEditorScreen` | Solo el del plan del alumno |

**Por qué dos campos y no texto libre:** `repTopOf` lee el tope del rango (`"8-12"` → 12) y de ahí sale la sugerencia automática de subir peso. Con texto libre, un "al fallo" o un "20 por lado" apagan esa sugerencia **en silencio**, sin que el coach se entere. Dos campos numéricos dan la libertad pedida y conservan el formato que el resto de la app ya sabe leer.

## El diseño

### Agrupar por selección

En la cabecera del día, junto a "+ EJ.", aparece **AGRUPAR**. Al tocarlo, el día entra en **modo selección**:

- cada ejercicio muestra una casilla y se puede tocar para marcarlo;
- abajo aparece una barra: `AGRUPAR 3 EJERCICIOS EN SUPERSERIE B` y un botón de cancelar;
- al confirmar, los seleccionados **se mueven para quedar consecutivos**, en el orden en que se marcaron, y reciben la letra.

La letra se asigna sola: la primera superserie del día es **A**, la siguiente **B**, y así. El coach no escribe nada.

**Deshacer** es simétrico: un ejercicio agrupado muestra su etiqueta; tocarla lo saca del grupo. Si un grupo queda con un solo ejercicio, deja de ser superserie (un grupo de uno no es un grupo).

### Cómo se ve

Cada grupo tiene un **color** de una paleta de seis, asignado por letra: A, B, C… El color aparece en el borde izquierdo de los ejercicios del grupo y en su etiqueta (`⛓ SUPERSERIE A`). Con más de seis grupos en un día —caso que no existe en la práctica— la paleta se repite.

**Esto es deliberadamente distinto de lo que ve el alumno.** En la app del alumno las superseries se marcan con un corchete gris, sin color, porque el sistema es monocromo y el único color está reservado para las alertas del coach. Acá el coach está *armando* el plan y necesita escanear agrupaciones de un vistazo; el alumno solo las *ejecuta*. Es una divergencia asumida a conciencia, no un descuido.

### Objetivo de reps

Los chips se reemplazan por dos campos numéricos, `DESDE` y `HASTA`, que se guardan como el mismo string de siempre (`"8-12"`). El teclado es numérico. Se conservan los valores actuales al editar un ejercicio existente: `"8-12"` llena 8 y 12.

Si el coach deja los campos vacíos, se usa el valor por omisión de la base (`8-12`), igual que hoy.

## Lo que NO cambia

- **El formato en la base de datos.** `reps_objective` sigue siendo `text` con el mismo formato `"desde-hasta"`, y `superseries_group` sigue siendo `text`. **Sin migración.**
- **Los planes existentes siguen funcionando.** Las superseries viejas tienen etiquetas escritas a mano ("Superserie 1"); se muestran tal cual, con su color, y se pueden desagrupar. No se reescriben solas.
- La app del alumno, la web y `groupBySuperseries` no se tocan.
- El tema no se modifica. La paleta de colores de superserie vive en el módulo de superseries, no en el tema: no es parte del sistema de color de la app, es una ayuda de autoría.

## Arquitectura

La lógica se extrae a un módulo propio, `trainer-app/src/lib/superseries.ts`, con funciones puras y tests:

- `nextGroupLabel(existing: string[]): string` — la próxima letra libre del día.
- `applyGrouping(exercises, selectedIds, label)` — devuelve la lista reordenada con el grupo asignado.
- `removeFromGroup(exercises, exerciseId)` — saca un ejercicio y disuelve el grupo si queda de uno.
- `colorForLabel(label: string): string` — el color de la paleta.

`PlanEditorScreen` tiene 1.116 líneas y es el archivo más frágil del proyecto; `ProgramEditorScreen` tiene 739 y duplica su lógica. Sacar el cálculo a un módulo compartido es lo que evita escribir dos veces el reordenamiento —y equivocarse en una de las dos—, y es lo único que hace testeable la parte que puede corromper un plan.

## Pruebas

- Tests unitarios de las cuatro funciones puras, incluyendo: agrupar no consecutivos, agrupar respetando el orden de selección, letra siguiente cuando ya existen A y C (debe dar B), disolver un grupo que queda de uno, y planes viejos con etiquetas escritas a mano.
- Los 73 tests existentes deben seguir pasando; `npx tsc --noEmit -p .` limpio.
- Verificación en TestFlight: crear una superserie con ejercicios no adyacentes y **confirmar en la app del alumno** que se ven juntos y en orden; editar un ejercicio viejo y ver que sus reps se cargan bien; guardar un rango nuevo (7-9) y comprobar que la sugerencia de subir peso lo respeta.

## Riesgos

**`PlanEditorScreen` es el archivo más frágil del proyecto.** Reordenar ejercicios toca `order_index`, que es lo que determina qué entrena el alumno y en qué orden. Un error acá corrompe planes de gente real. Por eso el reordenamiento vive en funciones puras con tests, y la pantalla solo las llama.

**Seis coaches y sus alumnos están usando el producto.** Rama aparte, un solo merge al final, y verificación en TestFlight antes de fusionar.
