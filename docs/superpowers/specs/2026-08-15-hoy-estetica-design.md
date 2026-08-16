# Rediseño estético de "Hoy" (app del alumno) — Diseño

**Fecha:** 2026-08-15
**Estado:** aprobado por el dueño del producto

## Problema

El dueño pidió varias veces que la app "se viera mejor". Los intentos anteriores entregaron **arquitectura de información** —agrupar accesos, renombrar entradas, agregar señales de estado— que hizo la app más comprensible pero **no cambió nada visual**: mismos grises, misma tipografía, mismas tarjetas planas.

El diagnóstico real, mirando `trainer-app/src/screens/client/TodayScreen.tsx`: **todo pesa lo mismo**. El ejercicio que toca ahora, el que ya se hizo y el que viene después tienen el mismo tamaño de texto, el mismo contraste y la misma caja. El progreso del día es una barra de 5px casi invisible. El peso de referencia —el dato que el alumno busca cuando está frente a la máquina— vive perdido en una línea gris junto al grupo muscular y el conteo de series.

La app no se ve plana por falta de color. Se ve plana porque **nada indica dónde mirar**.

## Referencia elegida: Whoop

De cuatro referencias propuestas (Whoop, Nike Training Club, Strava, Linear/Arc), el dueño eligió **Whoop**. Es la mejor noticia posible porque **valida el sistema existente** en vez de exigir tirarlo: negro profundo, monoespaciada para datos, cero decoración, el dato como protagonista.

Lo que Whoop hace y esta app no:
- un **dato héroe** que domina cada pantalla,
- **anillos de progreso** en vez de barras,
- jerarquía brutal entre lo urgente y lo secundario,
- **datos que entran animándose** en vez de aparecer de golpe.

## Decisiones tomadas

| Decisión | Elección | Descartado |
|---|---|---|
| Referencia estética | Whoop | Nike Training Club; Strava; Linear/Arc |
| Pantalla de partida | "Hoy" del alumno | "Progreso"; lista del coach; construir el sistema primero |
| Dirección visual | Dato héroe con anillo | Filas puras sin tarjetas; profundidad con sombras y gradiente |
| Movimiento | Anillo + entrada escalonada | Solo el anillo; agregar latido permanente |
| Elementos secundarios | Bajar de jerarquía | Esconderlos tras un gesto; dejarlos igual |

**Por qué se descartó el latido permanente:** una animación que nunca se detiene compite con el contenido, gasta batería y molesta a la décima apertura. Esta pantalla se abre varias veces por sesión, con el teléfono apoyado en una máquina.

**Fuera de alcance:** el resto de las pantallas del alumno (Inicio, Progreso, Perfil), toda la app del coach, y la web. Esta pantalla fija el lenguaje visual; propagarlo es trabajo posterior.

## El diseño

### Jerarquía, de mayor a menor peso

1. **Anillo de progreso del día** — 132px, centrado, con `hechos/total` en Anton dentro y la etiqueta `EJERCICIOS` debajo. Bajo el anillo, el nombre del día (`PIERNAS`) en Anton 24px.
2. **Ejercicio siguiente** — blanco puro (`#FFFFFF`, más claro que `textPrimary`), 14px peso 800, con la etiqueta `SIGUIENTE · N SERIES · X-Y` y su peso de referencia en mono 21px.
3. **Ejercicios pendientes** — `textPrimary` 13px peso 700, peso en mono 18px `textMuted`.
4. **Ejercicios completados** — opacidad 45%, mostrando lo que efectivamente levantó (`60×10`) en vez del peso de referencia, con un ✓ discreto.
5. **Selector de días** — píldoras pequeñas bajo el anillo (9px, `letterSpacing` 1). El día activo va en fondo `accent` con texto `background`.
6. **Navegación de semana** — arriba a la derecha, 9px `textMuted`, con chevrones al 50% de opacidad.
7. **Cardio y nota al coach** — al final, en cajas de borde `border` sin relleno, texto `textSecondary`/`textMuted`.

### Filas, no tarjetas

Cada ejercicio deja de ser una `Card` con borde, relleno y miniatura, y pasa a ser una **fila separada por una línea superior de 1px** (`colors.border`). Menos cajas y menos bordes es lo que hace que una interfaz densa se lea cara en vez de recargada.

**Consecuencia aceptada:** desaparece la miniatura del ejercicio de esta pantalla. La imagen y el video siguen disponibles al tocar el ejercicio, en `WorkoutLogScreen`.

### Movimiento

Al montar la pantalla (y al cambiar de día):
- el **anillo se llena** desde 0 hasta su valor, ~1.1s, con curva de desaceleración (`cubic-bezier(.22,1,.36,1)` o su equivalente en spring);
- el **número del centro** aparece con un fundido de ~0.8s, empezando 0.15s después;
- las **filas de ejercicio** entran en cascada: cada una sube 10px con fundido, ~0.5s, escalonadas 80ms entre sí.

Sin animaciones en bucle. Todo respeta la preferencia de **"reducir movimiento"** del sistema: con ella activada, los elementos aparecen directamente en su estado final, sin transición.

Esa preferencia **hoy no se consulta en ninguna parte del proyecto** — hay que agregarla. Reanimated expone el hook `useReducedMotion()`, que es la vía a usar; no hace falta `AccessibilityInfo` ni suscribirse a cambios a mano.

**Implementación:** Reanimated 4, que ya está instalado (`~4.1.1`) y hoy prácticamente sin usar. Las animaciones corren en el hilo de UI, así que se mantienen fluidas mientras la pantalla carga datos. **Nunca usar `runOnJS`** — se eliminó en Reanimated 4; usar `scheduleOnRN` de `react-native-worklets`. Consultar la skill `react-native-best-practices` de Software Mansion antes de escribir las animaciones.

### El anillo es monocromo

En Whoop el anillo comunica con color (verde/amarillo/rojo según recuperación). Acá **no**: el sistema es monocromo por decisión documentada y el único color, el ámbar, está reservado para alertas del coach. El anillo comunica solo por cuánto se llena.

Es una diferencia real respecto a la referencia, asumida a conciencia: al 33% y al 100% será el mismo gris. La legibilidad se apoya en el número del centro (`1/3`), que dice explícitamente lo que el color diría en Whoop.

## Lo que NO cambia

- Ningún dato, consulta ni lógica de negocio. Es un cambio de presentación.
- Ninguna función se elimina: navegación de semanas, selector de días, registro de cardio y nota al coach siguen ahí, con menos peso visual.
- El tema (`colors`, `typography`, `spacing`, `radius`) no se modifica: el rediseño usa los tokens existentes. Si hiciera falta un token nuevo, se discute antes.
- El monocromo y la reserva del ámbar se respetan sin excepción.

## Pruebas

Es una pantalla, no lógica pura: se verifica **mirándola**, no con tests unitarios.

- Los 56 tests existentes de `trainer-app/` deben seguir pasando.
- `npx tsc --noEmit -p .` limpio.
- Verificación en un build de TestFlight, con estos casos: día sin ejercicios registrados (anillo en 0), día a medias, día completo (anillo lleno), día sin ejercicios en el plan, y una semana sin planificar.
- Con "reducir movimiento" activado en los ajustes de iOS, la pantalla debe mostrarse completa y sin animación.

## Riesgos

**Seis coaches y sus alumnos están usando el producto.** Rama aparte y un solo merge al final; nunca commits directos a `sandbox`, que despliega a producción.

**Es la pantalla más usada de la app.** Un error acá lo ve todo alumno que entrena. A cambio, es también donde una mejora se nota más.

**El cambio es visual y subjetivo.** Si al verlo en el teléfono no convence, revertir es barato: es una sola pantalla y una rama.
