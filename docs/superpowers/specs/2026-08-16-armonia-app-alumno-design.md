# Armonía visual en la app del alumno — Diseño

**Fecha:** 2026-08-16
**Estado:** aprobado por el dueño del producto

## Problema

El rediseño de "Hoy" acotó su alcance a una sola pantalla, a propósito, y dejó anotado que propagar el lenguaje era trabajo posterior. Ese trabajo es ahora: al verlo en el teléfono, el dueño lo describió así — *"la app perdió la armonía. Pareciera que cuando colocas 'Hoy' estás viendo otra app"*.

Es exactamente lo que pasó. "Hoy" habla un idioma —dato héroe, filas en vez de tarjetas, mono para las cifras, jerarquía por peso visual— que ninguna otra pantalla habla. Las otras siete son tarjetas con borde, tipografía chica pareja y ninguna cifra protagonista.

La incoherencia no es un problema estético abstracto: **rompe la confianza en el producto**. Una app donde una pantalla está cuidada y el resto no se lee como una app a medio hacer.

## Alcance

**Las siete pantallas restantes del alumno** (~2.800 líneas):

| Pantalla | Líneas | Tratamiento |
|---|---|---|
| `WorkoutLogScreen` | 764 | Héroe: el peso de referencia |
| `ProgressScreen` | 585 | Héroe: la mejor marca |
| `BodyProgressScreen` | 459 | Re-vestir |
| `CoachProfileScreen` | 399 | Re-vestir |
| `HomeScreen` | 335 | Héroe: días entrenados esta semana |
| `SessionDetailScreen` | 257 | Re-vestir |
| `HistoryScreen` | 197 | Re-vestir |

**Fuera de alcance:** toda la app del coach (13 pantallas, ~4.700 líneas) y la web. El coach nunca abre "Hoy": su app es otra superficie, con otro usuario, y no sufre esta incoherencia. Unificarla es un proyecto aparte — e incluye `PlanEditorScreen`, el archivo más frágil del proyecto.

## El principio: héroe donde lo hay, re-vestir donde no

Forzar un dato héroe en cada pantalla produciría un número grande que a nadie le importa —un Perfil que abre con una cifra vacía es peor que un Perfil sobrio—. Así que:

- **Tres pantallas tienen un dato que merece dominar** y lo reciben.
- **Cuatro no lo tienen** y se re-visten: filas en vez de tarjetas, mono para las cifras, la tipografía y el espaciado del sistema. Coherentes sin inventar protagonismo.

### Los tres héroes

1. **Registrar ejercicio** — el **peso de referencia** en mono 38px, bajo el nombre del ejercicio en Anton. Es lo que el alumno busca al llegar a la máquina.
2. **Inicio** — **días entrenados esta semana** (`3/5`) en Anton 56px, con barras de los días debajo. Responde "¿cómo voy?".
3. **Progreso** — la **mejor marca** en mono 46px (`140kg ×8`), con la semana en que se consiguió. Es el dato del que uno se enorgullece.

### Registrar ejercicio, en detalle

Es la peor ruptura de las siete: está a un toque de "Hoy" y es donde el alumno pasa la sesión entera. Las series dejan de ser tarjetas con bordes y pasan a filas, con los mismos tres estados que los ejercicios en "Hoy":

- **serie hecha** — atenuada, con lo levantado en mono y un ✓;
- **serie en curso** — línea superior clara, número de serie en blanco puro, campos sobre `surface`;
- **serie pendiente** — guiones en `textMuted`.

El "semana pasada: 115×10" pasa a vivir bajo la fila que le corresponde, en 9px, en vez de competir por atención.

## Primero el kit, después las pantallas

Antes de tocar ninguna pantalla se extrae el lenguaje a **componentes compartidos**. Copiar el estilo a mano en siete pantallas garantiza que vuelvan a divergir: es exactamente así como una app monocroma terminó con seis colores de biserie.

El kit sale de generalizar lo que "Hoy" ya tiene funcionando, no de inventar:

| Pieza | De dónde sale | Qué hace |
|---|---|---|
| `StatHero` | nuevo | Cifra grande + etiqueta, en Anton o mono según el dato |
| `DataRow` | generaliza `ExerciseRow` | Fila con línea superior: etiqueta, sub-etiqueta, valor a la derecha, tres estados |
| `SectionLabel` | repetido en 5 pantallas | La etiqueta de 8px con `letterSpacing` 2 |
| `ScreenHeader` | repetido en 7 pantallas | Fecha/título a la izquierda, acción a la derecha |
| `ProgressRing` | ya existe | Sin cambios |

`ExerciseRow` se mantiene como está: es específico de "Hoy" (biseries, peso de referencia, navegación al registro). `DataRow` es su versión genérica, y `ExerciseRow` **no** se reescribe encima de ella en este trabajo — reescribir una pantalla ya verificada para que herede de una abstracción nueva es riesgo sin beneficio.

## El monocromo se mantiene, también en el progreso

Hoy `ProgressScreen` pinta "mejorando" en verde y "por mejorar" en rojo. Se eliminan: `+12%` y `−2%` quedan del mismo gris, distinguidos por el signo.

Se evaluó usar el ámbar para lo que va cayendo y **se descartó**: el ámbar significa "esto requiere que el coach haga algo", y un ejercicio estancado del alumno no es eso. Gastarlo ahí le quita fuerza donde sí importa. Decisión tomada explícitamente por el dueño.

## Lo que NO cambia

- **Ningún dato, consulta ni lógica de negocio.** Es presentación.
- **Ninguna función se elimina.** En `WorkoutLogScreen` eso incluye el guardado automático, la sugerencia de subir peso, los chips de "¿cuándo lo hiciste?", el historial, el video y el mapa muscular.
- **El tema no se modifica.** Se usan los tokens existentes. El `#FFFFFF` del elemento "en curso" sigue siendo la única excepción, y sigue sin agregarse al tema.
- La app del coach y la web quedan intactas.

## Movimiento

`motion.ts` ya existe y gobierna el ritmo. Las pantallas nuevas usan la misma entrada escalonada de filas, con `rowDelay`, y respetan `useReducedMotion()`.

**No se anima nada más que la entrada.** En particular, las cifras héroe **no** cuentan hacia arriba: es un efecto que envejece mal y que en `WorkoutLogScreen` —una pantalla que se abre entre serie y serie— sería directamente molesto.

## Pruebas

- Los 68 tests existentes de `trainer-app/` deben seguir pasando; `npx tsc --noEmit -p .` limpio.
- El kit compartido es presentación pura, sin lógica que testear unitariamente. Si alguna pantalla necesita una función de cálculo nueva, esa sí lleva tests, en `src/lib/` y con los mismos casos en ambos lados si aplica.
- Verificación en TestFlight, pantalla por pantalla, con datos reales: un alumno con varias semanas registradas y uno recién empezando (todas las pantallas tienen estado vacío).
- Con "reducir movimiento" activado, todo debe verse completo y sin animación.

## Riesgos

**`WorkoutLogScreen` es la pantalla de más riesgo del proyecto después de `PlanEditorScreen`**: 764 líneas con guardado automático, sugerencias y corrección de fecha. Un error ahí le pierde datos a un alumno en medio de una sesión. Va en su propia tarea, con revisión propia, y su lógica no se toca.

**Es mucha superficie de una vez.** Siete pantallas en una rama es más de lo que conviene revisar de un tirón: el trabajo se ordena de mayor a menor impacto (kit → Registrar ejercicio → Inicio → Progreso → las cuatro restantes), de modo que si hay que parar a mitad de camino, lo entregado ya mejora la armonía en vez de dejarla a medias.

**Seis coaches y sus alumnos están usando el producto.** Rama aparte, un solo merge al final, y verificación en TestFlight antes de fusionar.
