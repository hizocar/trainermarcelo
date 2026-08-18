# Encadenar ejercicios y objetivo de reps libre (app del coach) — Diseño

**Fecha:** 2026-08-16
**Estado:** aprobado por el dueño del producto

## Problema

Dos fricciones en el editor de día del coach, reportadas con capturas y precisadas después: lo que Marcelo pedía es que **agrupar ejercicios en biseries o triseries sea fácil e intuitivo en el momento mismo en que arma o edita el plan**.

1. **Armar una superserie es un acto de fe.** El campo se llama "GRUPO / SUPERSERIE (opcional)" y es texto libre: el coach escribe "Superserie 1" en un ejercicio y tiene que acordarse de escribir exactamente lo mismo en el otro. Si se equivoca en una letra, no se agrupan y no hay ninguna señal de que algo salió mal.
2. **El objetivo de reps está encajonado.** Es una lista de chips fijos (`4-6`, `6-8`, `8-10`, `8-12`, `10-12`, `12-15`, `10-15`). Si el coach quiere 7-9 o 15-20, no puede.

## La decisión que simplifica todo: encadenar vecinos

`groupBySuperseries` (en `trainer-app/src/lib/plan.ts`) agrupa **solo ejercicios consecutivos** con la misma etiqueta. Un primer diseño resolvía esto con un modo de selección múltiple que reordenaba los ejercicios elegidos para dejarlos juntos.

Se descartó. En su lugar, **agrupar es unir un ejercicio con el de arriba**: entre dos ejercicios aparece un control de cadena, se toca, y quedan encadenados.

Es mejor por tres razones:

- **No hay modos.** Agrupar es parte de mirar la lista, no una operación que se entra y se sale.
- **Un toque por unión.** Encadenar un tercer ejercicio al grupo lo convierte en triserie solo, sin diálogos ni confirmaciones.
- **Elimina el riesgo grande.** Como solo une vecinos, la adyacencia está garantizada por construcción: **no hay que reordenar nada**. El diseño anterior tenía que mover ejercicios, y mover ejercicios toca `order_index`, que es lo que determina qué entrena el alumno y en qué orden. Un error ahí corrompe planes de gente real.

Si el coach quiere encadenar dos ejercicios que están separados, primero los junta con las flechas de subir y bajar que ya existen en cada tarjeta. Es un paso más, pero explícito y reversible, y es lo que ya sabe hacer.

## Decisiones tomadas

| Decisión | Elección | Descartado |
|---|---|---|
| Cómo se agrupa | Encadenar con el de arriba, un toque | Modo selección múltiple con reordenamiento; casilla al agregar el ejercicio |
| Objetivo de reps | Dos campos numéricos, "desde" y "hasta" | Un campo de texto totalmente libre; "hasta" opcional |
| Alcance | Los dos editores: `PlanEditorScreen` y `ProgramEditorScreen` | Solo el del plan del alumno |

**Por qué dos campos y no texto libre:** `repTopOf` lee el tope del rango (`"8-12"` → 12) y de ahí sale la sugerencia automática de subir peso. Con texto libre, un "al fallo" o un "20 por lado" apagan esa sugerencia **en silencio**, sin que el coach se entere. Dos campos numéricos dan la libertad pedida y conservan el formato que el resto de la app ya sabe leer.

**Por qué también el editor de programas:** hoy `ProgramEditorScreen` duplica la lógica de `PlanEditorScreen`. Arreglar solo uno dejaría al coach con dos editores que se comportan distinto según desde dónde entró.

## El diseño

### Encadenar

Entre dos ejercicios consecutivos aparece un control discreto: `⛓ unir`. Al tocarlo:

- si **ninguno** de los dos está en un grupo, nace una superserie nueva con la próxima letra libre del día;
- si el **de arriba** ya está en un grupo, el de abajo se suma a ese grupo (una biserie pasa a triserie);
- el control solo aparece entre ejercicios que **no** están ya en el mismo grupo.

Los ejercicios encadenados se dibujan dentro de una caja con borde de color y una etiqueta arriba: `⛓ BISERIE A`, `⛓ TRISERIE B` — el nombre se ajusta solo según cuántos ejercicios tenga.

**Deshacer** es simétrico: la etiqueta del grupo lleva un `✕` que lo disuelve completo, y cada ejercicio dentro del grupo tiene un `⛓✕` que lo saca solo a él. Si al sacar uno el grupo queda con un solo ejercicio, deja de ser superserie: un grupo de uno no es un grupo.

**La letra se asigna sola.** La primera superserie del día es **A**, la siguiente **B**. El coach no escribe nada, y el campo de texto "GRUPO / SUPERSERIE" desaparece del formulario de editar ejercicio.

### Cómo se ve

Cada grupo lleva un **color** de una paleta de seis, asignado por letra. El color va en el borde de la caja y en el fondo de la etiqueta.

**Esto es deliberadamente distinto de lo que ve el alumno.** En la app del alumno las superseries se marcan con un corchete gris, sin color, porque el sistema es monocromo y el único color está reservado para las alertas del coach. Acá el coach está *armando* el plan y necesita escanear agrupaciones de un vistazo; el alumno solo las *ejecuta*. Es una divergencia asumida a conciencia.

### Objetivo de reps

Los chips se reemplazan por dos campos numéricos, `DESDE` y `HASTA`, con teclado numérico, que se guardan como el string de siempre (`"8-12"`). Al editar un ejercicio existente se cargan sus valores actuales: `"8-12"` llena 8 y 12.

Si el coach deja ambos campos vacíos se usa `8-12`, el mismo valor por omisión que tiene la base hoy. Si escribe solo "desde", se guarda ese número solo (`"10"`), formato que `repTopOf` ya sabe leer.

## Lo que NO cambia

- **El formato en la base de datos.** `reps_objective` sigue siendo `text` con formato `"desde-hasta"`, y `superseries_group` sigue siendo `text`. **Sin migración.**
- **Los planes existentes siguen funcionando.** Las superseries viejas tienen etiquetas escritas a mano ("Superserie 1"); se siguen mostrando agrupadas, con su color, y se pueden disolver. No se reescriben solas.
- **`order_index` no se toca.** Encadenar no mueve ejercicios; el coach los ordena con las flechas que ya existen.
- La app del alumno, la web y `groupBySuperseries` no se tocan.
- El tema no se modifica. La paleta de colores vive en el módulo de superseries: no es parte del sistema de color de la app, es una ayuda de autoría.

## Arquitectura

La lógica se extrae a `trainer-app/src/lib/superseries.ts`, con funciones puras y tests:

- `nextGroupLabel(existing: (string | null)[]): string` — la próxima letra libre del día.
- `chainWith(exercises, exerciseId)` — encadena ese ejercicio con el de arriba y devuelve la lista con los grupos actualizados.
- `unchain(exercises, exerciseId)` — lo saca de su grupo, disolviendo el grupo si queda de uno.
- `dissolveGroup(exercises, label)` — deshace el grupo completo.
- `groupLabelFor(count: number, label: string)` — `"BISERIE A"` / `"TRISERIE A"` / `"SUPERSERIE A"` según cuántos sean.
- `colorForLabel(label: string): string` — el color de la paleta.

Ninguna de ellas reordena la lista: todas devuelven los mismos ejercicios en el mismo orden, cambiando solo `superseries_group`.

`PlanEditorScreen` tiene 1.116 líneas y es el archivo más frágil del proyecto; `ProgramEditorScreen` tiene 739 y duplica su lógica. Sacar el cálculo a un módulo compartido es lo que evita escribirlo dos veces y equivocarse en una, y es lo único que hace testeable la parte que decide qué queda agrupado con qué.

## Pruebas

Tests unitarios de las funciones puras, incluyendo:

- encadenar dos sueltos crea la letra A; con A ya usada, crea B;
- encadenar al de abajo de una biserie la convierte en triserie, sin crear letra nueva;
- con A y C existentes, la próxima letra es B;
- sacar un ejercicio de una biserie disuelve el grupo (el que queda deja de tener etiqueta);
- sacar uno de una triserie la deja como biserie;
- ninguna función cambia el orden de la lista;
- planes viejos con etiquetas escritas a mano ("Superserie 1") se disuelven bien y no rompen la asignación de letras.

Además: los 73 tests existentes siguen pasando y `npx tsc --noEmit -p .` limpio.

Verificación en TestFlight: encadenar dos ejercicios y **confirmar en la app del alumno** que se ven agrupados; convertir una biserie en triserie; disolver un grupo viejo hecho con el campo de texto; editar un ejercicio y ver que sus reps se cargan bien; guardar un rango nuevo (7-9) y comprobar que la sugerencia de subir peso lo respeta.

## Riesgos

**`PlanEditorScreen` es el archivo más frágil del proyecto.** El diseño elegido reduce el riesgo a propósito: al no reordenar, `order_index` no se toca y lo único que cambia es una columna de texto. Aun así, la pantalla solo llama funciones ya probadas; no calcula agrupaciones por su cuenta.

**Desaparece el campo de texto de superserie.** Un coach acostumbrado a escribir "Superserie 1" no lo va a encontrar. A cambio, ya no puede equivocarse escribiéndolo, que es el problema que originó el pedido.

**Seis coaches y sus alumnos están usando el producto.** Rama aparte, un solo merge al final, y verificación en TestFlight antes de fusionar.
