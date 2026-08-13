# Rediseño de la experiencia del coach — Diseño

**Fecha:** 2026-08-13
**Estado:** aprobado por el dueño del producto

## Problema

Marcelo, el coach de referencia, reporta que la app "no es intuitiva" y que "el historial de ejercicios no tiene una vista amigable". El inventario del código confirma tres problemas concretos, no de gusto:

1. **Cuatro vistas de progreso solapadas y sin jerarquía.** La ficha del cliente ofrece cinco botones apilados que compiten entre sí; tres de ellos son "ver progreso" con nombres distintos (`PROGRESO SEMANA A SEMANA`, `EVOLUCIÓN POR EJERCICIO`, y el historial por ejercicio al que se llega desde otra pantalla). Nada indica cuándo usar cada uno.

2. **La app y la web no hablan igual.** La misma función se llama `PROGRESO SEMANA A SEMANA` en la app y `SEMANA A SEMANA` en la web; `EVOLUCIÓN POR EJERCICIO` vs `EVOLUCIÓN`. El calendario existe solo en la web.

3. **El inicio del coach no dice nada.** `ClientListScreen` muestra por alumno un avatar, el nombre y el texto fijo "Ver plan de entrenamiento →". El dashboard web muestra avatar, nombre y email. Para saber quién dejó de entrenar hay que entrar alumno por alumno. Además, cuatro funciones completas (Mi gimnasio, Programas, Calculadoras, Ajustes) viven detrás de iconos sin etiqueta en el header — incluida Programas, que es justamente la que le ahorra horas a un coach con varios alumnos.

## Decisiones tomadas

| Decisión | Elección | Descartado |
|---|---|---|
| A quién optimizar | El coach primero | El alumno; ambos a la vez |
| Especialización | Web para planificar, app para el día a día | Todo en una sola |
| Editar planes en la app | Sigue igual de protagonista | Demoverlo o quitarlo |
| Organización de la ficha | Agrupar por intención | Pestañas; una vista con zoom |
| Inicio del coach | Lista con señal de estado por alumno | Bandeja de "requiere atención" |
| Color | Un único ámbar, solo para alertar | Monocromo puro; paleta verde/ámbar/rojo |
| Umbral de "necesita atención" | Según el plan de cada alumno | Días fijos; configurable por coach |

**Fuera de alcance:** la experiencia del alumno, el editor de planes (`PlanEditorScreen`, 1.116 líneas — el archivo más frágil del proyecto, y nada de esto lo requiere), el editor de programas, gestión de semanas, chat, medidas y fotos, calculadoras y suscripción. Ninguna función se elimina; solo cambia cómo se llega a ellas y cómo se llaman.

## Arquitectura

### Agrupación por intención

Los mismos tres grupos, en el mismo orden, en app y web:

- **CÓMO VA** → Esta semana · Calendario · Por ejercicio · Medidas y fotos
- **QUÉ VA A HACER** → Plan y semanas
- **HABLAR** → Chat

Cada entrada se nombra por la pregunta que responde, no por su mecanismo.

| Hoy (app) | Hoy (web) | Pasa a llamarse |
|---|---|---|
| `PROGRESO SEMANA A SEMANA` | `SEMANA A SEMANA` | **Esta semana** |
| `EVOLUCIÓN POR EJERCICIO` | `EVOLUCIÓN` | **Por ejercicio** |
| — (no existe) | `CALENDARIO` | **Calendario** (se agrega a la app) |
| `EDITAR PLAN · SEMANAS` | (en el cuerpo) | **Plan y semanas** |

### Señal de estado por alumno

La lista de alumnos —`ClientListScreen` en la app, `/dashboard` en la web— se parte en dos grupos: **NECESITAN ATENCIÓN** primero, **AL DÍA** después. Cada tarjeta muestra:

- días con entrenamiento registrado, sobre los días planificados de su semana (ej. "3 de 5 días")
- cuándo entrenó por última vez (ej. "entrenó ayer")
- mensajes sin leer, si los hay

### Definiciones

**Días planificados de la semana:** los `training_days` de la `plan_week` activa para la semana de programa en curso que tengan `week_day` definido. La semana activa se resuelve con `resolveActiveWeek`, que ya existe en ambos proyectos.

**Día cumplido:** un día planificado cuya sesión tiene al menos un `workout_log` registrado en cualquier día de esa misma semana de programa. Si el alumno movió el lunes al miércoles, cuenta como cumplido — mismo criterio que ya aplica el calendario tras el arreglo de I6.

**Necesita atención:** existe al menos un día planificado cuya fecha **ya pasó** y cuya sesión sigue sin registrarse en ningún día de la semana.

**"Ya pasó" se evalúa en el orden de la semana, no por el número del día.** `week_day` usa la convención de JavaScript (0=Dom … 6=Sáb), pero la semana del programa corre de lunes a domingo. Un día planificado ya pasó si su posición en el orden Lun→Dom es **estrictamente anterior** a la posición de hoy. El día de hoy nunca cuenta como perdido: mientras transcurre está "pendiente", igual que en el calendario. Ejemplo: hoy es miércoles (`week_day` 3, posición 2) y los días planificados son lunes (1, posición 0), miércoles (3, posición 2) y viernes (5, posición 4) → solo el lunes puede generar alerta.

**No son alerta:**
- Alumno sin plan asignado → muestra "sin plan", que es un pendiente del coach, no del alumno.
- Días planificados cuya fecha aún no llega → "pendiente".
- Un día cuyos ejercicios están todos archivados (`total === 0`) → sin señal.

### Dónde vive la lógica

Una función pura `clientStatus` en `trainer-app/src/lib/clientStatus.ts` y otra en `web/src/lib/clientStatus.ts`, ambas con tests unitarios.

Se duplica a propósito: `web/` y `trainer-app/` son proyectos npm separados sin paquete compartido, y unificarlos exigiría convertir el repo en un monorepo. Es la misma decisión ya tomada para `score()`/`oneRepMax()`. **La duplicación no es un defecto; que los valores diverjan sí lo es.** Los tests de ambos proyectos usan los mismos casos y afirman los mismos resultados.

Firma:

```
clientStatus(input: {
  plannedWeekDays: number[];   // 0=Dom..6=Sáb, de la semana activa
  completedWeekDays: number[]; // días planificados cuya sesión ya se registró
  todayWeekDay: number;        // 0=Dom..6=Sáb
  hasPlan: boolean;
}): {
  needsAttention: boolean;
  done: number;
  total: number;
}
```

### Carga de datos

En bloque, nunca por alumno: cuatro consultas fijas (planes de los alumnos del coach → semanas activas → días con sus series → registros de la semana en curso) y el cálculo en memoria. **El número de consultas no crece con la cantidad de alumnos.**

Esto no es una preferencia de estilo: la revisión del calendario encontró exactamente el error contrario —una consulta que crecía sin límite hasta fallar en silencio y dibujar el mes entero como "nadie entrenó"—. Las consultas con `.in(...)` deben acotarse a lo visible y **su error nunca debe descartarse**; un fallo de consulta tiene que verse en pantalla, no disfrazarse de "nadie entrenó".

### Color

Se agrega un único token de alerta ámbar (`#c9a227`), reservado exclusivamente para "esto requiere que hagas algo":

- app: `colors.warning` en `trainer-app/src/theme`
- web: `--warning` en `web/src/app/globals.css`

**`--danger` NO se toca.** Al escribir el plan se revisó `trainer-app/src/theme/index.ts` y el monocromo resultó ser una decisión documentada, no un descuido: *"Monocromo puro: 5 grises, sin matiz de color. La jerarquía se construye por brillo, no por tono — 'success' es más claro (vitalidad/progreso), 'danger' más oscuro (se apaga), en vez de verde/rojo."* Que `danger` sea gris es intencional. Lo que estuvo mal fue la leyenda del calendario que prometía un "borde rojo" inexistente, y eso ya se corrigió cambiando el texto, no el color.

El ámbar entra como **la única excepción** al monocromo, y precisamente por ser la única tiene fuerza. En la app, el token existente `warning` (hoy `#949DA6`, un gris) pasa a `#c9a227`; en la web se agrega `--warning`. Ningún otro token cambia.

No se adopta una paleta verde/ámbar/rojo: cuando todo tiene color nada destaca, y el par verde/rojo excluye a quien no los distingue —alrededor de 1 de cada 12 hombres, y la base de usuarios es mayoritariamente masculina.

### Zona horaria

La web calcula fechas en `America/Santiago` mediante el helper `santiagoDayKey` que ya existe (el servidor de Vercel corre en UTC y sin esto una sesión de la tarde cae al día siguiente). La app usa la zona del teléfono, coherente con el resto de la app.

Para usuarios en Chile ambas coinciden. Para un coach en otro huso no, y **esta asimetría se documenta pero no se resuelve acá**: es previa a este rediseño y afecta a `getCurrentWeek()` en ambos proyectos, que está fijado por paridad.

## Pruebas

**Unitarias**, en ambos proyectos, con los mismos casos y los mismos resultados esperados:

- alumno sin plan → `needsAttention: false`, sin conteo
- día planificado que aún no llega → no es alerta
- **el día de hoy, planificado y aún sin registrar → no es alerta** (está en curso)
- **domingo planificado con hoy lunes → no es alerta** (el domingo es el final de la semana, no el principio: verifica el orden Lun→Dom)
- día planificado ya pasado y sin registrar → alerta
- sesión movida a otro día de la semana → cuenta como cumplida, no es alerta
- semana completa → no es alerta, `done === total`
- alumno sin ningún registro y con días ya pasados → alerta

**Manual**, en el preview de Vercel con datos reales insertados y borrados después, sobre la cuenta demo (`appreview.coach@elitefitapp.com`). La cuenta demo la revisa Apple: **debe quedar sin datos de prueba**.

**App:** verificación en un build de TestFlight antes de dar el trabajo por cerrado.

## Riesgos

**Seis coaches están usando el producto ahora mismo.** Todo el trabajo va en una rama aparte con preview de Vercel y un único merge al final — el mismo procedimiento que se usó para el calendario. Nunca commits directos a `sandbox`, que despliega a producción.

**Renombrar cosas que los coaches ya aprendieron** tiene un costo de reaprendizaje. Se asume: los nombres nuevos son más descriptivos y estamos en beta temprana, cuando el costo de cambiarlos es el más bajo que va a ser.

## Orden de entrega

La web primero, a propósito: se despliega en minutos y permite validar el concepto con Marcelo sin depender de la aprobación de Apple.

1. `clientStatus` puro + tests, en ambos proyectos
2. Token ámbar en el tema y corrección de `--danger`
3. Web: dashboard con estado por alumno
4. Web: ficha del cliente agrupada + renombres
5. App: inicio con estado por alumno
6. App: ficha del cliente agrupada + renombres
7. App: pantalla de calendario (paridad con la web)

Los pasos 1–4 son desplegables por sí solos y ya entregan valor. Los pasos 5–7 requieren un build de TestFlight, que además debe agregarse a mano al grupo "Coaches Beta" en App Store Connect.
