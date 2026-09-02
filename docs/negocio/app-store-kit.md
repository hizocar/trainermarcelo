# Kit de publicación en App Store — listo para pegar

Todo lo que App Store Connect pide para mandar la v1.0.0 a revisión, en el
orden en que lo pide. Los textos respetan los límites de caracteres de Apple.

## 1. Ficha

| Campo | Valor |
|---|---|
| Nombre (≤30) | `EliteFitness` |
| Subtítulo (≤30) | `Entrena con tu coach` |
| Categoría primaria | Salud y forma física |
| Categoría secundaria | Estilo de vida |
| Clasificación | 4+ (sin contenido objetable) |
| Precio | Gratis |
| URL de soporte | `https://elitefitapp.com` |
| URL de marketing | `https://elitefitapp.com` |

## 2. Texto promocional (≤170 caracteres)

> Tu entrenamiento, en serio: plan de tu coach o rutina armada por ti,
> cronómetro en la pantalla bloqueada y tu progreso músculo a músculo.

## 3. Descripción (≤4000 caracteres)

> EliteFitness es la app para entrenar con método — con tu coach, o por tu cuenta.
>
> **Si entrenas con un coach:**
> — Tu plan siempre al día: días, ejercicios, series y repeticiones que tu coach arma y ajusta por ti
> — Registra cada serie en segundos, incluso sin señal en el gimnasio
> — Superseries, tempo, RIR y videos de técnica en cada ejercicio
> — Chat directo con tu coach, con notas de voz
> — Tus sesiones agendadas, visibles en tu día
>
> **Si entrenas por tu cuenta:**
> — Ármate tu rutina gratis: elige tus días y coloca ejercicios de una biblioteca de más de 800
> — Registra tu peso y repeticiones igual que un alumno con coach
> — Cuando quieras dar el salto, encuentra tu entrenador en elitefitapp.com
>
> **Para todos:**
> — Comienza tu entrenamiento y el cronómetro corre en tu pantalla bloqueada
> — Al terminar, comparte tu sesión: minutos, ejercicios y el mapa de músculos trabajados
> — Historial completo: cada serie, cada semana, cada marca personal
> — Tu progreso en gráficos: volumen, 1RM estimado, medidas y fotos
>
> Y si eres coach: gestiona a todos tus alumnos desde elitefitapp.com — planes
> desde el computador, seguimiento de quién entrenó sin preguntar, y un
> marketplace donde los alumnos te encuentran.

## 4. Palabras clave (≤100 caracteres, separadas por coma, sin espacios)

```
entrenador,personal,gym,rutina,pesas,gimnasio,fitness,entrenamiento,coach,series,fuerza,progreso
```

## 5. Notas de la versión 1.0.0 ("Novedades")

> Primera versión pública:
> • Entrena el plan de tu coach o ármate tu rutina gratis
> • Cronómetro de sesión visible en la pantalla bloqueada
> • Comparte tu sesión con el mapa de músculos trabajados
> • Registro de series que funciona sin señal
> • Chat con tu coach, agenda de sesiones y ficha de salud

## 6. Privacidad (App Privacy — declarar exactamente esto)

**¿Rastrea a usuarios entre apps? NO** (no hay ATT, no hay publicidad de terceros).

Datos recolectados, **vinculados a la identidad** del usuario:

| Categoría de Apple | Qué es en nuestra app |
|---|---|
| Información de contacto → Email y Nombre | La cuenta |
| Salud y forma física → Forma física | Series, pesos, sesiones, duración |
| Contenido de usuario → Fotos/Audio | Fotos de progreso/avatar; notas de voz del chat |
| Identificadores → ID de usuario | El id de la cuenta |
| Datos de uso → Interacción con el producto | Los eventos de uso (pantallas y acciones) |

Datos **no vinculados**: Diagnóstico → Datos de fallos (Sentry).
Propósito en todos: "Funcionalidad de la app" y "Analítica" — nunca "Publicidad".

## 7. Información de revisión (Review Notes)

Cuentas demo para el revisor — las tres existen y están verificadas en la base:

```
Coach:            appreview.coach@elitefitapp.com  / AppleReview2026!
Alumno con coach: appreview.client@elitefitapp.com / AppleReview2026!
Alumno SIN coach: appreview.solo@elitefitapp.com   / AppleReview2026!
```

La tercera es la clave para la revisión: entra sin coach y puede armar su
rutina gratis desde cero — la funcionalidad que hace la app usable para
cualquiera que la descargue.

Notas sugeridas para el revisor (en inglés):

> EliteFitness is a training app for coaches and their clients.
> — Log in as the COACH demo to see client management (the full coach panel
>   lives on our website; the app focuses on daily training).
> — Log in as the CLIENT demo to build your own free routine (no coach
>   needed): tap "ARMAR MI RUTINA", add days and exercises, then start a
>   workout — the timer runs as a Live Activity on the lock screen.
> — No purchases happen inside the app. Coach subscriptions are sold on our
>   website only.

## 8. Capturas de pantalla (lo único que falta fabricar)

Apple exige capturas de 6.7" (1290×2796). Plan:

1. Marcelo o Sebastián capturan EN EL TELÉFONO (build 68) estas 6 pantallas:
   Hoy con el día cargado · registro de series · cronómetro corriendo ·
   pantalla bloqueada con el widget · la tarjeta de compartir · Mi rutina.
2. Me las pasan crudas y yo las compongo en marcos de App Store con titulares
   (el mismo pipeline de los avisos de Meta) en la resolución exacta.

## 9. El orden de los clics en App Store Connect

1. App Store → pestaña "App Store" → crear versión **1.0.0** (si no existe)
2. Adjuntar el **build 68** cuando aparezca procesado
3. Pegar los textos de este kit (secciones 1-5)
4. App Privacy → declarar la tabla de la sección 6
5. Review Information → cuentas demo + notas (sección 7)
6. Subir capturas (sección 8)
7. **Enviar a revisión** — Apple suele responder en 24-48 h
