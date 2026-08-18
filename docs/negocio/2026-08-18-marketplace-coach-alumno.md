# Conectar coaches y alumnos dentro de la plataforma

**Fecha:** 2026-08-18
**Estado:** idea registrada, sin diseñar ni construir
**Origen:** propuesta del dueño

## La idea

Que elitefitapp.com y la app dejen de ser solo la herramienta de trabajo del coach y sirvan también para **conectar a quien busca entrenador con quien busca clientes**.

Dos entradas nuevas:

- **Alumnos que buscan coach.** Hoy no existen en el producto: se entra solo por invitación de un entrenador.
- **Coaches que buscan clientes.** Hoy llegan con su cartera hecha; la app les sirve para atenderla, no para crecerla.

**El incentivo:** al coach que consigue su **primer** alumno a través de la plataforma se le regala **un mes de uso de la app**. Una sola vez, no por cada alumno.

**El alumno nunca paga suscripción.** Se le ayuda a encontrar coach y se le ofrece la app; quien paga sigue siendo el entrenador.

**El marketplace vive en la web, no en la app** (decidido el 2026-08-18, corrige una decisión anterior). El alumno que busca coach lo hace desde el navegador; recién cuando un entrenador lo toma entra a la app, que sigue siendo lo que es hoy: la herramienta de entrenamiento, no un directorio.

Esto tiene tres consecuencias buenas:

- **No depende de las tiendas.** Se puede probar si el marketplace se puebla mientras Apple revisa la app, en vez de después.
- **Desaparece el problema del alumno huérfano.** Nadie entra a la app sin coach, así que no hay que inventarle una pantalla ni rediseñar la navegación.
- **La app no se contamina.** Sigue siendo un complemento con un propósito claro, en vez de cargar con un directorio que no le corresponde.

El mes gratis del coach se activa al tomar a su primer alumno del marketplace, y es **una sola vez por coach**, no uno por cada alumno.

**Para qué sirve realmente:** darle visibilidad a la app. No es una línea de ingresos —el alumno no paga y el coach recibe un descuento— sino un **canal de captación**: cada alumno que busca coach es alguien que conoce el producto, y cada coach que consigue un cliente por acá tiene una razón para quedarse.

**El alumno como palanca de adopción.** No basta con que el alumno encuentre coach: hay que engancharlo para que **quiera que su coach use la app**. Hoy la adopción depende solo del entrenador; acá aparece un segundo empuje, desde el lado del cliente, que es quien más gana con que su plan esté ordenado y su progreso registrado. Un alumno que ya vio la app pidiéndole a su coach que la use vale más que cualquier argumento de venta.

## Por qué encaja

**El incentivo se paga en producto, no en efectivo.** No hay costo hasta que hay resultado, y el resultado —un alumno nuevo— aumenta el uso de la app y la dependencia del coach hacia ella. Un coach con más alumnos dentro tiene más razones para quedarse.

**Cambia lo que se vende.** Hoy el argumento es "te ahorro la planilla": una herramienta que compite contra Excel y WhatsApp, y que el coach puede abandonar sin perder nada. Traer clientes es un argumento distinto, porque **paga la suscripción sola**: un alumno nuevo vale muchas veces los $4.990 del plan.

**Aprovecha lo que ya existe.** La ficha del coach dentro de la app —foto, portada, especialidad, Instagram— ya está construida y es prácticamente un perfil público. Lo que falta no es el perfil: es que alguien de fuera pueda verlo.

## Lo que hay que resolver antes de construir

**1. El huevo y la gallina.** Sin alumnos buscando, ningún coach se registra para conseguirlos; sin coaches visibles, ningún alumno busca. Los marketplaces se mueren ahí. Hay que decidir por qué lado se parte, y probablemente sea **el de la demanda**: seis coaches beta ya existen, alumnos buscando todavía no.

**2. La atribución, acotada por la regla de "un solo mes".** ¿Cómo se sabe que un alumno llegó *por la plataforma* y no era un cliente que el coach ya tenía? La decisión de regalar **un mes por el primer alumno, una sola vez**, convierte esto de un agujero abierto en un riesgo con techo: lo máximo que puede costar una trampa es un mes por coach, para siempre. A esta escala se puede verificar a mano y no hace falta construir un sistema de atribución antes de lanzar. Habrá que construirlo si el volumen crece.

**3. Contradice una decisión que se acaba de tomar.** La landing se rediseñó el 2026-08-18 para hablarle **solo al coach**, con el argumento explícito de que el alumno no puede registrarse ni paga. Esta idea convierte al alumno en un usuario que **sí** se registra por su cuenta. No es un impedimento, pero la página habría que volver a pensarla — y sería la segunda vez en poco tiempo.

**4. Confianza entre desconocidos.** Hoy la relación coach-alumno nace fuera de la app: ya se conocen. Poner en contacto a extraños trae preguntas que el producto nunca ha tenido que responder: quién valida que un coach es quien dice ser, qué pasa si la cosa sale mal, si hay reseñas, si se cobra dentro o fuera de la plataforma.

**5. Qué se le muestra al alumno.** Un buscador necesita algo por lo que filtrar: ubicación, presencial o remoto, especialidad, precio, disponibilidad. Nada de eso existe hoy en la ficha del coach.

**6. Resuelto:** *qué ve un alumno sin coach al abrir la app.* Era el problema más grande de la etapa 2 —toda la app asume que un alumno tiene entrenador— y la decisión de que **vea solo el marketplace** lo convierte en una pantalla con propósito en vez de un estado roto. No hay que rediseñar la app para un usuario huérfano: hay que darle una sola cosa que hacer.

## Cómo incentivar al coach, más allá del mes gratis

El mes gratis es el enganche inicial, pero no la única palanca. Otra, sin costo: **el coach con suscripción activa se muestra primero** en el listado. Ordenar por quién paga es una forma de que la suscripción valga por sí sola, no solo por las funciones.

**El reparo, para que quede escrito:** si el orden termina dependiendo *únicamente* de quién paga, el alumno deja de encontrar al coach que le sirve y encuentra al que compró el lugar. Cuando eso pasa, los alumnos dejan de venir y el canal se muere — y con él, el incentivo. La prioridad por suscripción debería ser **un factor entre varios** (cercanía, especialidad, si acepta alumnos nuevos), no el único criterio.

## Cómo medir si funciona

Hay dos preguntas distintas y conviene no confundirlas, porque llevan a decisiones opuestas:

1. **¿El canal trae gente?** Se mide en solicitudes de alumnos y coaches nuevos registrados desde el marketplace.
2. **¿El producto convence?** Se mide en cuántos coaches siguen pagando después del mes gratis.

Un coach que no renueva **no significa que el canal falle**: significa que la app no lo convenció. Meter ambas cosas en una sola cifra —"cuántos siguieron pagando"— lleva a cerrar un canal que estaba funcionando por un problema que vive en el producto.

## La dependencia de las tiendas

**Estado al 2026-08-18, verificado:** la app **no está publicada en ninguna App Store** (se consultó Chile, Estados Unidos, México, Argentina y España: cero resultados). Existe solo en TestFlight. En Android nunca se ha compilado: hay identificador e icono, pero no hay `versionCode` ni cuenta de Google Play conectada.

Esto **no bloquea todo por igual**, y conviene no confundirlo:

- **La campaña de registro de coaches no necesita la tienda.** El coach trabaja desde el panel web, sin instalar nada. Publicar, registrar entrenadores y poblar la base se puede hacer hoy.
- **La llegada del alumno sí la necesita.** El alumno solo tiene la app —no hay panel web para él— y a un desconocido no se le puede pedir que instale TestFlight, cree una cuenta beta y acepte una compilación que caduca a los 90 días. El embudo se rompería justo cuando funciona.

**Conclusión:** enviar la app a revisión de la App Store es el camino más largo y no depende de ninguna otra etapa, así que debería empezar **en paralelo con la etapa 0**, no después.

**Android es un proyecto aparte**, no un paso más: primera compilación, cuenta de Google Play y, si la cuenta de desarrollador es personal, la prueba cerrada de 12 testers durante 14 días que Google exige antes de publicar. Verificar ese requisito temprano, porque agrega semanas.

## El camino, por etapas

Ordenado por **riesgo, no por dificultad**: primero se prueba lo que puede hacer fracasar todo, que es si aparecen alumnos buscando coach. Esa pregunta no necesita código.

### Etapa 0 — Confirmar que hay demanda (sin construir nada)

Marcelo y los coaches beta publican en sus redes que se puede pedir coach a través de EliteFitness. El interesado escribe al WhatsApp que **ya está** en la página. La conexión se hace a mano.

**Qué se aprende:** si escribe alguien. Es la única pregunta que importa en esta etapa, y construir un buscador antes de responderla es apostar.

**Qué cuesta:** nada de desarrollo. Una publicación y responder mensajes.

**Cuándo pasar a la etapa 1:** cuando haya suficientes solicitudes como para que responder a mano moleste.

### Etapa 1 — Perfil público del coach y un formulario

- La ficha del coach que ya existe dentro de la app se publica como página pública (`/coach/marcelo-herrera`), para que se pueda compartir por Instagram o WhatsApp.
- Un formulario de "busco coach" en la web, que deja los datos y avisa.
- El emparejamiento sigue siendo **a mano**.

**Qué se aprende:** qué buscan los alumnos, con sus palabras. Eso define los filtros de la etapa 2, en vez de inventarlos.

### Etapa 2 — El alumno se registra solo y busca

- Registro de alumno **sin invitación**, que hoy no existe: es el cambio más grande, porque toda la app asume que un alumno tiene coach.
- Un listado de coaches con los filtros que la etapa 1 haya demostrado que importan.
- Solicitud de contacto, con el coach pudiendo aceptar o rechazar.
- El alumno sin coach entra directo al marketplace: es lo único que ve hasta que un entrenador lo tome. Las pestañas de plan, progreso y perfil aparecen recién entonces.

### Etapa 3 — El incentivo automático

- Marcar de dónde vino cada alumno.
- Aplicar el mes gratis al primer alumno conseguido, **una sola vez por coach** (decidido el 2026-08-18).
- Reflejarlo en la suscripción.

Antes de esta etapa el incentivo se aplica **a mano**, que con la regla de "un solo mes" es perfectamente viable.

## Lo que NO se decide acá

Este documento **registra la idea y su orden**, no la diseña. Cada etapa a partir de la 1 merece su propia sesión de diseño. La 2 en particular toca supuestos profundos del producto —que todo alumno tiene coach— y no debería empezarse sin haber pasado por la 0 y la 1.
