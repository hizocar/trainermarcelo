# EliteFitness

Dos superficies en un repo: `trainer-app/` (React Native / Expo, iOS) y `web/` (Next.js 15, App Router). Backend compartido en Supabase.

## Skills de diseño: cuál usar dónde

Hay varias skills de diseño instaladas y **no todas aplican acá**. Antes de tocar UI:

- **`trainer-app/` → usa `expo:expo-native-ui`** (Apple HIG, colores semánticos, tipografía, sombras, controles nativos) y **`react-native-best-practices`** de Software Mansion para animaciones, gestos y SVG.
- **`web/` → `frontend-design`**. Las skills `ui-ux-pro-max`, `huashu-design` y las de Emil Kowalski están instaladas pero **no se han adoptado**: asumen web con CSS y librerías tipo Framer Motion. No las uses sin preguntar.
- **Nunca uses una skill web para la app**: en React Native no hay CSS, las animaciones van con Reanimated, y librerías como Sonner no existen.

## El monocromo es deliberado

El tema es monocromo a propósito — ver el comentario al inicio de `trainer-app/src/theme/index.ts`. La jerarquía se construye con brillo, no con tono; que `danger` sea gris **no es un descuido**.

Existe **un solo color**: el ámbar `#C9A227` (`colors.warning` / `--warning`), reservado exclusivamente para "esto requiere que el coach haga algo". Su fuerza viene de ser el único. Usarlo para decorar, o agregar otros colores semánticos, es un defecto — aunque una skill de diseño lo sugiera.

## Reglas que salieron de bugs reales

- **Fechas:** la web corre en UTC (Vercel) y los usuarios están en Chile. Para resolver "qué semana es" o "qué día es", usa `santiagoCurrentWeek()` / `santiagoDayKey()` de `web/src/lib/weeks.ts`, **nunca** `getCurrentWeek()` — ese está fijado por paridad con la app y calcularlo en UTC marcaba a todos los alumnos como "necesitan atención" los domingos por la tarde.
- **`week_day` usa la numeración de JavaScript (0=domingo)** pero la semana del programa corre de lunes a domingo. Comparar los números sin convertir hace que un domingo planificado se dé por perdido cada lunes.
- **Consultas:** número fijo de consultas, ningún `.in(...)` acotado por el número de series de un plan, y **nunca descartar el `error`**. Un error tragado se convierte en una mentira tranquilizadora ("nadie entrenó", "sin plan"), y así se fue a producción un bug que dibujaba meses enteros vacíos.
- **La lógica pura duplicada entre `web/` y `trainer-app/`** (`clientStatus`, `score`, `oneRepMax`) es una decisión tomada: son proyectos npm separados sin paquete compartido. Lo que sí es defecto es que los **valores** diverjan; hay tests en ambos lados con los mismos casos.

## Producción

`sandbox` es la rama por defecto y **despliega automáticamente a elitefitapp.com**, donde hay coaches beta usando el producto. Para trabajo de varios pasos: rama aparte, preview de Vercel, y un solo merge al final.
