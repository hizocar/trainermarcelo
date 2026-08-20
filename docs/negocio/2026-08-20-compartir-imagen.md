# Compartir una imagen en redes desde la app

**Fecha:** 2026-08-20
**Estado:** investigación, sin diseñar ni construir

## Qué se quiere

Que el alumno pueda compartir en sus redes una imagen generada por la app —su
entrenamiento del día, una marca personal, su semana— como hacen Strava o Nike
Run Club.

## Cómo se hace, técnicamente

Son tres pasos, y ninguno necesita servidor:

1. **Dibujar la tarjeta.** Se arma como una pantalla normal de React Native,
   fuera de vista o en una pantalla de previsualización. Se puede reutilizar lo
   que ya existe: el anillo de progreso, la tipografía Anton, el mapa muscular.
2. **Capturarla como imagen.** `react-native-view-shot` toma cualquier vista y
   devuelve un archivo PNG.
3. **Compartirla.** `expo-sharing` abre la hoja de compartir de iOS, desde donde
   el alumno elige Instagram, WhatsApp o lo que tenga. Opcionalmente,
   `expo-media-library` permite guardarla en el carrete.

## Versiones exactas para este proyecto (SDK 54)

Verificadas contra la lista del propio SDK, **no** contra la última publicada en
npm — las últimas son de SDK 57 e instalarlas rompería la app:

| Paquete | Versión para SDK 54 | Última en npm (NO usar) |
|---|---|---|
| `react-native-view-shot` | `4.0.3` | 5.1.1 |
| `expo-sharing` | `~14.0.8` | 57.0.14 |
| `expo-media-library` | `~18.2.1` | 57.0.4 |
| `expo-image-manipulator` | `~14.0.8` | 57.0.12 |

Se instalan con `npx expo install <paquete>`, que elige la versión correcta sola.
Todos son MIT y ya vienen soportados por Expo, así que **no hace falta escribir
código nativo**, pero **sí una compilación nueva**: no salen por actualización
remota.

## Las dos formas de compartir

**Hoja de compartir de iOS** (`expo-sharing`). Un solo camino que sirve para
todas las apps que el alumno tenga instaladas. Es lo más simple y lo que
recomiendo para empezar.

**Directo a Instagram Stories.** Instagram tiene un esquema de URL propio que
abre la historia con la imagen ya puesta y permite adjuntar un enlace. Da mejor
experiencia en el canal más usado, pero exige declarar el esquema en la
configuración de iOS y registrarse como app en Facebook. Es trabajo aparte y
solo vale la pena si la primera versión demuestra que la gente comparte.

## Por qué esto conecta con el negocio

Cada imagen compartida lleva la marca de la app a las redes de un alumno, que es
exactamente el público que el marketplace quiere atraer. Es **distribución
gratuita**: el alumno comparte porque está orgulloso de su marca, no porque le
estemos pidiendo que promocione nada.

Y se refuerza con la palanca ya identificada en el documento del marketplace: un
alumno que comparte su progreso es un alumno que le va a pedir a su coach que
siga usando la app.

## Lo que hay que decidir antes de construir

1. **Qué se comparte.** No es lo mismo una tarjeta del entrenamiento del día
   que una de récord personal o un resumen semanal. La que más se comparte en
   otras apps es la de **logro** —una marca nueva—, porque es lo que da orgullo;
   el resumen diario se comparte mucho menos.
2. **Cuándo se ofrece.** Un botón permanente se ignora. Aparecer justo al batir
   una marca es lo que convierte la intención en acción.
3. **Qué lleva la imagen.** Nombre del alumno, marca de la app, ¿el nombre del
   coach? Esto último es interesante: convierte al alumno en publicidad de su
   entrenador, que es justo lo que el coach quiere.
4. **Qué NO puede llevar.** Nada que exponga datos de otras personas.

## Estado

Investigación terminada. Construirlo merece una sesión de diseño propia: la
parte técnica es de un día, pero **qué se comparte y cuándo** decide si alguien
lo usa o si es un botón muerto.
