# Kit de publicación en Google Play — listo para pegar

Cuenta **personal** de Google Play Console (decisión del 26-sep-2026). Todo lo
que la consola pide, en el orden en que lo pide. Cada cuadro gris se copia
completo y se pega tal cual.

> Diferencias con el kit de App Store (`app-store-kit.md`): Android **no tiene
> Live Activity** (el cronómetro en la pantalla bloqueada es solo de iPhone),
> así que ningún texto de esta ficha lo menciona. Y en Android la app no lleva
> a pagar (ver PR #85), así que tampoco se habla de suscripciones.

## 0. Antes de empezar — bloqueos pendientes

- [ ] **Borrar cuenta desde la app + URL pública para pedirlo.** Google lo exige
      en el formulario de Seguridad de los datos para cualquier app que permita
      crear cuentas. Hoy solo se puede por correo. *(pendiente de construir)*
- [ ] **Correo de soporte de la marca.** La política de privacidad y la ficha
      muestran `hizocar@gmail.com`. Google publica ese correo en la ficha.
- [ ] **Firebase / FCM** para que lleguen las notificaciones en Android.

## 1. Crear la cuenta (lo hace Sebastián)

1. play.google.com/console → **Crear cuenta de desarrollador** → tipo **"Para ti"** (personal).
2. **Nombre de desarrollador** (público, bajo el título de la app): `EliteFitness`
   — o el nombre del estudio si va a agrupar varias apps. Se puede cambiar después.
3. Pagar **US$25** y verificar identidad con el carnet.
4. Verificar el teléfono y el correo de contacto.
5. Si la consola lo pide: instalar la app **Google Play Console** en un Android y
   verificar el dispositivo con la misma cuenta.

## 2. Ficha de Play Store

| Campo | Valor |
|---|---|
| Nombre de la app (≤30) | `EliteFitness` |
| Categoría | Salud y bienestar |
| Etiquetas | Fitness, Entrenamiento, Registro de ejercicio |
| Correo de contacto | *(el correo de soporte de la marca — ver §0)* |
| Sitio web | `https://elitefitapp.com` |
| Política de privacidad | `https://elitefitapp.com/privacy` |

**Descripción breve (≤80)**

```
Entrena el plan de tu coach, registra cada serie y mira tu progreso.
```

**Descripción completa (≤4000)**

```
EliteFitness es la app para entrenar con método — con tu coach, o por tu cuenta.

SI ENTRENAS CON UN COACH:
— Tu plan siempre al día: días, ejercicios, series y repeticiones que tu coach arma y ajusta por ti
— Cada set con su objetivo: repeticiones, descanso, tempo e intensidad (RIR, RPE, % RM o carga)
— Registra cada serie en segundos, incluso sin señal en el gimnasio
— Videos de técnica y las indicaciones de tu coach en cada ejercicio
— Chat directo con tu coach, con notas de voz
— Tus sesiones agendadas, visibles en tu día

SI ENTRENAS POR TU CUENTA:
— Ármate tu rutina gratis: elige tus días y coloca ejercicios de una biblioteca de más de 800
— Registra tu peso y repeticiones igual que un alumno con coach

PARA TODOS:
— Tu racha de entrenamiento, para no perder el ritmo
— Al terminar, comparte tu sesión: minutos, ejercicios y el mapa de músculos trabajados
— Historial completo: cada serie, cada semana, cada marca personal
— Tu progreso en gráficos: volumen, 1RM estimado, medidas y fotos

Si eres coach, gestiona a todos tus alumnos desde elitefitapp.com: planes desde el computador y seguimiento de quién entrenó sin preguntar.
```

**Gráficos**

| Recurso | Tamaño | Estado |
|---|---|---|
| Ícono | 512×512 PNG | Exportar desde `trainer-app/assets/icon.png` |
| Gráfico destacado | 1024×500 | Por diseñar |
| Capturas de teléfono | mín. 2, 16:9 o 9:16 | Recapturar **en Android** (las de iPhone muestran el Live Activity) |

## 3. Contenido de la app (Política → Contenido de la app)

**Acceso a la app** → "Toda o parte de la funcionalidad está restringida" → instrucciones:

```
Usuario: appreview.solo@elitefitapp.com
Contraseña: AppleReview2026!
Cuenta de alumno sin coach: toca "ARMAR MI RUTINA" para crear una rutina, agregar días y ejercicios, y empezar un entrenamiento.
```

**Anuncios** → No, la app no contiene anuncios.

**Clasificación de contenido** (cuestionario IARC) — categoría *Otra / Utilidad,
productividad, comunicación*:
- Violencia, sexo, lenguaje, drogas, apuestas: **No** en todo.
- ¿Los usuarios pueden interactuar o intercambiar contenido? **Sí** (chat con el coach).
- ¿Comparte la ubicación del usuario? **No**.
- ¿Permite compras digitales? **No**.

**Público objetivo** → **18 años o más**. *(Elegir menores activa la política de
Familias, con exigencias extra que la app no necesita.)*

**App de salud** → Declarar como app de **fitness / registro de ejercicio**, sin
funciones médicas ni de diagnóstico.

## 4. Seguridad de los datos

**¿Recopila o comparte datos?** Sí recopila · **No comparte** (Supabase y Sentry
son proveedores que procesan datos por cuenta nuestra: según Google eso no
cuenta como "compartir").

**¿Datos cifrados en tránsito?** Sí (todo va por HTTPS).
**¿Los usuarios pueden pedir que se borren sus datos?** Sí *(requiere §0)*.
**URL para borrar la cuenta:** *(pendiente — ver §0)*

| Categoría de Google | Tipo | ¿Obligatorio? | Propósito | Qué es en la app |
|---|---|---|---|---|
| Información personal | Nombre | Sí | Funcionalidad, Administración de la cuenta | Nombre de la cuenta |
| Información personal | Dirección de correo | Sí | Funcionalidad, Administración de la cuenta | Inicio de sesión |
| Información personal | ID de usuario | Sí | Funcionalidad, Administración de la cuenta | Id de la cuenta |
| Salud y fitness | Información de fitness | Sí | Funcionalidad | Series, pesos, sesiones, rachas |
| Salud y fitness | Información de salud | Opcional | Funcionalidad | Ficha de salud (PAR-Q) y medidas corporales |
| Mensajes | Otros mensajes en la app | Opcional | Funcionalidad | Chat con el coach |
| Fotos y videos | Fotos | Opcional | Funcionalidad | Avatar, fotos de progreso |
| Fotos y videos | Videos | Opcional | Funcionalidad | Videos de técnica |
| Audio | Grabaciones de voz | Opcional | Funcionalidad | Notas de voz del chat |
| Actividad en la app | Interacciones | Sí | Estadísticas | Eventos de uso (pantallas y acciones) |
| Info y rendimiento | Registros de fallos | Sí | Estadísticas | Sentry |
| Info y rendimiento | Diagnósticos | Sí | Estadísticas | Sentry |
| ID de dispositivo u otros | ID de dispositivo u otros | Opcional | Funcionalidad | Token de notificaciones push |

Nada se usa para **publicidad** ni **se vende**.

## 5. Prueba cerrada (12 probadores × 14 días)

Obligatoria para cuentas personales antes de publicar. Los 14 días son
**corridos por persona**: si alguien se sale y vuelve, su contador parte de cero.

1. Probar y publicar → **Prueba cerrada** → crear pista.
2. Probadores → **lista de correos** (las cuentas de Google con que usan Play Store).
   Juntar al menos **14** para tener margen: coaches, alumnos, equipo.
3. Subir el build (`eas build -p android --profile production` + `eas submit`).
4. Copiar el **enlace de participación** y mandarlo con el mensaje de abajo.
5. Al día 14 con 12+ inscritos: **Solicitar acceso a producción**. Google pregunta
   cómo fue la prueba; respuesta sugerida en §6.

**Mensaje para los probadores** (reemplazar `[ENLACE]`):

```
¡Hola! Estamos publicando EliteFitness para Android y necesitamos tu ayuda: Google nos pide que 12 personas la prueben durante 14 días.

1) Abre este enlace desde tu teléfono Android y toca "Unirme a la prueba": [ENLACE]
2) Instala EliteFitness desde Play Store (el mismo enlace te lleva).
3) Entra con tu usuario y clave de siempre.

Lo único importante: no te salgas del programa de prueba en estos 14 días. Si encuentras algo raro, mándanos una captura. ¡Gracias!
```

## 6. Solicitud de acceso a producción (respuestas sugeridas)

- **¿Cómo reclutaron probadores?** Coaches que ya usan la versión de iPhone y sus alumnos.
- **¿Qué comentarios recibieron y qué cambiaron?** *(completar con lo que salga de la prueba)*
- **¿Está lista para producción?** Sí: la misma app está publicada en App Store desde septiembre de 2026.
