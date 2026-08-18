# elitefitapp.com para el coach — Diseño

**Fecha:** 2026-08-18
**Estado:** aprobado por el dueño del producto

## Problema

La landing le habla al alumno. El título dice *"Tu plan. Tu progreso. Registra cada serie… diseñado por tu coach"*, y la sección para entrenadores aparece a mitad de página, después de tres bloques que no le hablan a él.

Eso está al revés de cómo funciona el negocio: **el alumno no puede registrarse** —entra solo por invitación de su coach— **y no paga**. El que decide y paga es el coach. La página convence a quien no puede comprar, y al comprador lo atiende cuando ya se fue.

El pedido del dueño fue "hacerla más al estilo nuevo de la app" y "lograr una presentación que atraiga a los coaches". El estilo es la mitad menor del problema.

## Decisiones tomadas

| Decisión | Elección | Descartado |
|---|---|---|
| A quién le habla | Coach primero, alumno en un bloque al final | Solo coaches; dos páginas separadas |
| Acción principal | Agendar una demo | Crear cuenta y probar solo; solo WhatsApp |
| Cómo se agenda | WhatsApp directo a Marcelo (+56 9 4968 4325) | Calendario embebido (Cal.com); formulario propio |
| Título | "Deja la planilla. No a tus alumnos." | "Sabe quién entrenó, sin preguntar"; "Más alumnos, sin más horas" |

**Por qué WhatsApp y no un calendario:** el dueño lo prefirió por simplicidad. No exige cuentas nuevas ni servicios externos, funciona hoy, y a esta escala —seis coaches beta— la conversación personal convierte mejor que la reserva automática. El costo asumido: no queda registro de cuántos lo intentaron, y depende de que alguien conteste.

**Por qué ese título:** ataca la herramienta que el coach usa hoy. El competidor real no es otra app: es Excel más WhatsApp.

## La página, en orden

1. **Portada.** El título en Anton, una frase que explica el cómo, y `AGENDAR UNA DEMO` (que abre WhatsApp con el mensaje ya escrito) con `crear mi cuenta` al lado como salida secundaria. Debajo, tres cifras en línea: **841 ejercicios**, **alumnos ilimitados**, **$4.990 al mes**. El precio va arriba a propósito: un coach que lo descubre tarde se siente vendido.
2. **"Sabe quién entrenó, sin preguntar."** Captura real del panel: la lista de alumnos partida entre los que necesitan atención y los que van al día.
3. **"Armas el plan una vez."** Captura del editor: biseries, semanas, programas reutilizables.
4. **"Así lo ve tu alumno."** Capturas de la app. Esta sección vende sola: el coach entiende que va a quedar bien parado frente a sus clientes.
5. **Precios.** Los tres planes que ya existen, sin cambios de contenido.
6. **"¿Eres alumno?"** Bloque corto al final: te invitaron, descarga la app acá.

## Estilo

El lenguaje visual de la app: negro profundo, **Anton** para los títulos, **monoespaciada** para las cifras, líneas en vez de cajas, y **sin color** — ni siquiera el ámbar, que en la app significa "el coach tiene que hacer algo" y acá no aplica.

Se van los gradientes y las píldoras decorativas de la landing actual. La densidad y el contraste hacen el trabajo que hoy hacen los adornos.

## Las capturas

**Son el corazón de la propuesta.** Reemplazan la lista de características en texto: un coach que ve la pantalla de "quién entrenó y quién no" entiende en dos segundos lo que tres párrafos no logran.

- Las del **panel web** se toman del preview con el navegador, con datos reales de una cuenta de prueba.
- Las de la **app** las entrega el dueño como archivos PNG en `web/public/capturas/`. Sin ellas, la sección 4 no se puede construir con material real.

**Ninguna captura puede mostrar datos de alumnos reales.** Se usa una cuenta de prueba, o se editan los nombres antes de publicarlas.

## Lo que NO cambia

- **Los precios y los planes**: mismos montos, mismos límites.
- **El resto del sitio**: `/signup`, `/set-password`, la política de privacidad y el panel del coach quedan intactos.
- **La app**: este trabajo es solo `web/`.
- **Sin dependencias nuevas** ni servicios externos.

## Pruebas

- `npm run build` en `web/` pasa y los tests existentes siguen en verde.
- La página se revisa **en teléfono y en computador**: la mayoría de los coaches va a llegar desde el teléfono, por un enlace que les mandaron.
- El enlace de WhatsApp se prueba de verdad: debe abrir el chat con el número correcto y el mensaje escrito.
- Las capturas se revisan una por una buscando datos de alumnos reales antes de publicar.

## Riesgos

**La página es lo primero que ve un coach que no conoce el producto.** Hoy despliega automáticamente al fusionar a `sandbox`, así que va a una rama con preview y se mira antes de fusionar.

**Sin las capturas de la app, la sección que mejor vende queda vacía.** Si no llegan, la página se puede publicar con las del panel, pero pierde su mejor argumento.
