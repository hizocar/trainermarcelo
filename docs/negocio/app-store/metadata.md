# Envío a la App Store — textos y checklist

**Fecha:** 2026-08-18
**App:** EliteFitness · `com.trainermarcelo.app` · App Store Connect ID `6788209434`

Los textos de abajo son para copiar y pegar en App Store Connect. Están escritos
para **el alumno**, que es quien descarga la app desde la tienda — el coach llega
por elitefitapp.com, no buscando en el App Store.

---

## Nombre
```
EliteFitness
```

## Subtítulo (máx. 30 caracteres)
```
Tu plan y tu progreso real
```

## Texto promocional (máx. 170, se puede cambiar sin nueva revisión)
```
Registra cada serie, mira cómo avanzas semana a semana y entrena con el plan que tu coach armó para ti. Sin planillas, sin capturas de pantalla.
```

## Descripción
```
EliteFitness es la app donde entrenas con el plan que tu entrenador armó para ti, y donde queda registrado todo lo que levantas.

TU ENTRENAMIENTO DEL DÍA
Abre la app y ve exactamente qué te toca hoy: los ejercicios, las series, las repeticiones objetivo y el peso de referencia que dejó tu coach. Marca cada serie a medida que la haces.

TU PROGRESO, DE VERDAD
Cada serie que registras alimenta tu historial. Mira tu mejor marca en cada ejercicio, cuánto peso levantaste por semana y en qué estás mejorando. Sin planillas ni fotos del cuaderno.

DESCANSOS QUE FUNCIONAN
Temporizador de descanso con avisos, aunque tengas el teléfono bloqueado.

BISERIES Y TRISERIES
Si tu coach encadenó ejercicios, los ves agrupados y en orden.

CARDIO Y ENERGÍA
Registra tu cardio y cómo te sientes cada día. Con el tiempo vas a ver cómo se relaciona tu energía con lo que rindes.

TU COACH, A UN TOQUE
Escríbele desde la app, déjale notas en cada sesión y recibe sus cambios al instante.

CÓMO SE ENTRA
Necesitas que tu entrenador te invite: él arma tu plan y te da acceso. Si todavía no tienes entrenador, entra a elitefitapp.com.
```

## Palabras clave (máx. 100 caracteres, separadas por coma, sin espacios)
```
entrenamiento,gimnasio,rutina,pesas,progreso,series,repeticiones,coach,entrenador,fuerza
```

## Novedades de esta versión
```
Rediseño completo: tu día se abre con un anillo de progreso, cada ejercicio muestra las series que llevas, y el registro es más rápido de leer entre serie y serie.

- Descansos de 1, 2 o 3 minutos que siguen corriendo con la pantalla bloqueada y te avisan cuando toca seguir.
- Tu ánimo del día ahora se registra con caritas, y ves su historial.
- Mapa muscular nuevo, más claro.
- Tu coach puede encadenar ejercicios en biseries y triseries.
```

## URLs
- **Soporte:** https://elitefitapp.com
- **Privacidad:** https://elitefitapp.com/privacy
- **Marketing (opcional):** https://elitefitapp.com

## Categoría
- Principal: **Salud y forma física**
- Secundaria: (dejar vacía)

## Clasificación por edad
Sin contenido objetable → **4+**. Nota: la app tiene chat entre coach y alumno,
así que al responder el cuestionario hay que marcar que existe comunicación
entre usuarios; eso puede subir la clasificación a **12+**. Responder con la
verdad, no con la clasificación deseada.

## Cuenta de prueba para la revisión (obligatoria)
Apple necesita entrar sin invitación. Ambas cuentas ya existen:

- **Alumno:** `appreview.client@elitefitapp.com`
- **Coach:** `appreview.coach@elitefitapp.com`
- Contraseña de ambas: la de revisión de Apple que ya está en uso.

**Nota para el revisor** (campo "Notas"):
```
El acceso a esta app es por invitación del entrenador. Use la cuenta de alumno
para ver la experiencia principal (plan del día, registro de series, progreso).
La cuenta de coach permite ver el lado del entrenador. El panel web del
entrenador está en elitefitapp.com.
```

## Capturas
En `capturas-6.9/`, ya al tamaño exacto que pide Apple para pantallas de 6,9"
(1320×2868). Las de 6,5" las genera Apple automáticamente a partir de estas.

Orden sugerido: el día de entrenamiento, la semana, la evolución, el historial
y el perfil con la ficha del coach.

**Revisado:** ninguna muestra datos de alumnos reales; los correos de la última
están difuminados.

---

## Lo que solo puedes hacer tú, en App Store Connect

1. Crear la versión 1.0.0 y elegir la compilación (la última disponible).
2. Pegar los textos de arriba y subir las capturas.
3. Responder el cuestionario de privacidad — qué datos recolecta la app y para
   qué. Recolecta: correo, nombre, datos de entrenamiento y fotos de progreso;
   nada se vende ni se usa para publicidad.
4. Completar el cuestionario de clasificación por edad.
5. Poner la cuenta de prueba y la nota al revisor.
6. Enviar a revisión.

**Ya resuelto en el código:** la declaración de criptografía
(`usesNonExemptEncryption: false`), así que App Store Connect no volverá a
preguntarlo en cada envío.
