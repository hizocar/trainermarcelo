# Conectar coaches y alumnos dentro de la plataforma

**Fecha:** 2026-08-18
**Estado:** idea registrada, sin diseñar ni construir
**Origen:** propuesta del dueño

## La idea

Que elitefitapp.com y la app dejen de ser solo la herramienta de trabajo del coach y sirvan también para **conectar a quien busca entrenador con quien busca clientes**.

Dos entradas nuevas:

- **Alumnos que buscan coach.** Hoy no existen en el producto: se entra solo por invitación de un entrenador.
- **Coaches que buscan clientes.** Hoy llegan con su cartera hecha; la app les sirve para atenderla, no para crecerla.

**El incentivo:** al coach que consigue clientes a través de la plataforma se le regala **un mes de uso de la app** por cada uno (o según la regla que se defina).

## Por qué encaja

**El incentivo se paga en producto, no en efectivo.** No hay costo hasta que hay resultado, y el resultado —un alumno nuevo— aumenta el uso de la app y la dependencia del coach hacia ella. Un coach con más alumnos dentro tiene más razones para quedarse.

**Cambia lo que se vende.** Hoy el argumento es "te ahorro la planilla": una herramienta que compite contra Excel y WhatsApp, y que el coach puede abandonar sin perder nada. Traer clientes es un argumento distinto, porque **paga la suscripción sola**: un alumno nuevo vale muchas veces los $4.990 del plan.

**Aprovecha lo que ya existe.** La ficha del coach dentro de la app —foto, portada, especialidad, Instagram— ya está construida y es prácticamente un perfil público. Lo que falta no es el perfil: es que alguien de fuera pueda verlo.

## Lo que hay que resolver antes de construir

**1. El huevo y la gallina.** Sin alumnos buscando, ningún coach se registra para conseguirlos; sin coaches visibles, ningún alumno busca. Los marketplaces se mueren ahí. Hay que decidir por qué lado se parte, y probablemente sea **el de la demanda**: seis coaches beta ya existen, alumnos buscando todavía no.

**2. La atribución, que es lo que puede romper el negocio.** ¿Cómo se sabe que un alumno llegó *por la plataforma* y no era un cliente que el coach ya tenía? Sin una regla clara, cualquier coach registra a sus alumnos de siempre como "conseguidos aquí" y acumula meses gratis. No es mala fe necesariamente: es lo que ocurre cuando la regla es ambigua. Hay que definirlo antes de prometer nada.

**3. Contradice una decisión que se acaba de tomar.** La landing se rediseñó el 2026-08-18 para hablarle **solo al coach**, con el argumento explícito de que el alumno no puede registrarse ni paga. Esta idea convierte al alumno en un usuario que **sí** se registra por su cuenta. No es un impedimento, pero la página habría que volver a pensarla — y sería la segunda vez en poco tiempo.

**4. Confianza entre desconocidos.** Hoy la relación coach-alumno nace fuera de la app: ya se conocen. Poner en contacto a extraños trae preguntas que el producto nunca ha tenido que responder: quién valida que un coach es quien dice ser, qué pasa si la cosa sale mal, si hay reseñas, si se cobra dentro o fuera de la plataforma.

**5. Qué se le muestra al alumno.** Un buscador necesita algo por lo que filtrar: ubicación, presencial o remoto, especialidad, precio, disponibilidad. Nada de eso existe hoy en la ficha del coach.

## Lo que habría que construir (estimación gruesa, sin diseñar)

- Registro de alumno **sin invitación**, que hoy no existe.
- Perfil público del coach, a partir de la ficha que ya existe.
- Buscador con filtros, y por lo tanto los campos para filtrar.
- Un mecanismo de contacto y de aceptación: el coach debe poder decir que no.
- Atribución y el crédito de meses gratis, ligado a la suscripción.

## Lo que NO se decide acá

Este documento **registra la idea**, no la diseña. Cuando se decida construirla, corresponde una sesión de diseño propia: es un cambio de modelo de negocio, no una funcionalidad más — y las preguntas 1, 2 y 4 de arriba deberían responderse antes de escribir una línea de código.
