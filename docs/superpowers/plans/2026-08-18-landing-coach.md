# Landing orientada al coach — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que elitefitapp.com le hable al coach —que es quien decide y paga— en vez de al alumno, y que se vea como la app.

**Architecture:** Se reescribe el contenido y la estructura de una sola página (`web/src/app/page.tsx`), apoyándose en el sistema visual que la web **ya tiene**: mismas variables de color que la app, y las fuentes Anton, Inter y JetBrains Mono ya cargadas en `layout.tsx`. No se agregan dependencias, fuentes ni tokens: se quita decoración y se cambia el argumento.

**Tech Stack:** Next.js 15 (App Router), React 19, CSS plano con variables en `globals.css`.

## Global Constraints

- **Rama:** trabajar en `feat/encadenar-y-reps`, que ya está activa y tiene el resto del trabajo. **NUNCA commitear ni pushear a `sandbox`** — despliega automáticamente a producción (elitefitapp.com).
- **Solo se toca `web/`.** No se modifica `trainer-app/`, ni la base de datos: sin migraciones, sin consultas nuevas.
- **Sin dependencias nuevas** en `web/package.json`.
- **No se tocan** `/signup`, `/login`, `/set-password`, la política de privacidad ni el panel del coach. Este plan es la página pública `/` y sus estilos.
- **Los precios no cambian:** $4.990 (Solo, 1 entrenador), $9.990 (Starter, 2-3), y el tercer plan tal como está hoy. Mismos montos, mismos límites, mismo texto de "clientes siempre ilimitados".
- **Monocromo estricto.** Se usan las variables que ya existen en `globals.css` (`--bg`, `--surface`, `--accent`, `--text-secondary`, `--text-muted`, `--border`). **El ámbar `--warning` no se usa en esta página**: en la app significa "esto requiere que el coach haga algo" y acá no aplica. No se inventan colores.
- **El número de WhatsApp es +56 9 4968 4325**, que ya se usa en el sitio como `https://wa.me/56949684325`. El enlace nuevo debe llevar mensaje prellenado.
- **Ninguna captura puede mostrar datos de alumnos reales.** Las cinco que hay en `web/public/capturas/` ya fueron revisadas y tienen los correos difuminados.
- **Idioma:** español de Chile.
- **Commits:** uno por tarea, en español (`feat:` / `fix:` / `refactor:`).
- `npm run build` en `web/` debe pasar y los tests existentes seguir en verde en cada tarea.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `web/src/app/page.tsx` | **modificar** — la página completa: contenido y estructura |
| `web/src/app/globals.css` | **modificar** — estilos de las secciones nuevas; se eliminan los de las que se van |
| `web/src/components/PhoneFrame.tsx` | **crear** — marco de teléfono que enmarca cada captura |
| `web/public/capturas/*.png` | **ya existen** — `inicio.png`, `hoy.png`, `evolucion.png`, `historial.png`, `perfil.png`, a 662×1440 |

`page.tsx` tiene 338 líneas y sigue siendo una sola página; se mantiene así. Lo único que se extrae es el marco de teléfono, porque se repite cinco veces y lleva su propia maquetación.

---

### Task 1: El marco de teléfono

Las capturas necesitan un marco que las presente como pantallas de app y no como imágenes sueltas. Se usa cinco veces, así que va en su propio componente.

**Files:**
- Create: `web/src/components/PhoneFrame.tsx`
- Modify: `web/src/app/globals.css` (agregar al final)

**Interfaces:**
- Consumes: nada
- Produces: `<PhoneFrame src={string} alt={string} priority?={boolean} />` — export default; las tareas 2 y 3 lo usan

**Antes de escribir:** `next/image` **no se usa hoy en ninguna parte de `web/`** — esta es su primera aparición. Verificado que no hace falta configurar nada: `next.config.mjs` no tiene `output: 'export'`, así que la optimización de imágenes de Next funciona tal cual en Vercel para archivos servidos desde `public/`.

- [ ] **Step 1: Crear el componente**

Crear `web/src/components/PhoneFrame.tsx`:

```tsx
import Image from 'next/image';

interface Props {
  /** ruta pública de la captura, p. ej. "/capturas/hoy.png" */
  src: string;
  /** qué muestra la pantalla, para quien no ve la imagen */
  alt: string;
  /** true solo en la captura visible sin hacer scroll */
  priority?: boolean;
}

/**
 * Enmarca una captura de la app como pantalla de teléfono.
 *
 * Las capturas están a 662×1440 (el doble de su tamaño de presentación) para
 * que se vean nítidas en pantallas retina. El marco es sobrio a propósito: la
 * captura ya es el contenido, un marco decorado competiría con ella.
 */
export default function PhoneFrame({ src, alt, priority = false }: Props) {
  return (
    <div className="phone-frame">
      <Image
        src={src}
        alt={alt}
        width={662}
        height={1440}
        sizes="(max-width: 720px) 60vw, 300px"
        priority={priority}
        className="phone-shot"
      />
    </div>
  );
}
```

- [ ] **Step 2: Agregar los estilos**

Agregar al final de `web/src/app/globals.css`:

```css
/* ── Capturas de la app ──────────────────────────────── */
.phone-frame {
  border: 1px solid var(--border-light);
  border-radius: 22px;
  padding: 5px;
  background: var(--surface);
  width: fit-content;
}
.phone-shot {
  display: block;
  width: 300px;
  height: auto;
  border-radius: 17px;
}
@media (max-width: 720px) {
  .phone-shot { width: 60vw; max-width: 300px; }
}
```

- [ ] **Step 3: Verificar**

```bash
cd web && npm run build
```

Esperado: compila sin errores. El componente todavía no se usa en ninguna parte, así que la página no cambia.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/PhoneFrame.tsx web/src/app/globals.css
git commit -m "feat(web): marco de teléfono para las capturas de la app"
```

---

### Task 2: La portada le habla al coach

La parte de más impacto: es lo único que la mayoría va a leer.

**Files:**
- Modify: `web/src/app/page.tsx` (el `<nav>` y el bloque `{/* HERO */}`, líneas ~8-56)
- Modify: `web/src/app/globals.css`

**Interfaces:**
- Consumes: `<PhoneFrame src alt priority? />` (Tarea 1)
- Produces: nada

- [ ] **Step 1: Leer la página antes de tocarla**

Leer `web/src/app/page.tsx` completo (338 líneas). Su estructura actual es: `nav`, `hero`, `cómo-funciona`, `características`, `coach`, `precios`, `faq`, `cta-final`, `footer`. Esta tarea toca solo el `nav` y el `hero`.

Fíjate en `web/src/app/globals.css`: las variables de color ya son las mismas que las de la app, y `layout.tsx` ya carga Anton (`--font-display`), Inter (`--font-body`) y JetBrains Mono (`--font-mono`). **No agregues fuentes ni tokens.**

- [ ] **Step 2: Reemplazar los enlaces del nav**

Hoy el menú dice: Cómo funciona · Características · Precios · Para coaches · Descargar. Con la página reorientada, "Para coaches" deja de tener sentido como sección aparte —es la página entera— y "Descargar" apunta a un bloque que pasa a ser del alumno.

Reemplazar los enlaces por:

```tsx
          <div className="nav-links">
            <a href="#panel">Cómo funciona</a>
            <a href="#app">La app de tu alumno</a>
            <a href="#precios">Precios</a>
          </div>
```

El botón "Acceso coach" a `/login` se conserva tal cual.

- [ ] **Step 3: Reescribir la portada**

Reemplazar todo el bloque `{/* HERO */}` (el `<header className="hero">…</header>`) por:

```tsx
      {/* PORTADA — le habla al coach, que es quien decide y paga */}
      <header className="hero">
        <div className="container hero-grid">
          <div>
            <span className="hero-badge fade-up">Para entrenadores</span>
            <h1 className="fade-up d1">
              Deja la planilla.<br />
              <em>No a tus alumnos.</em>
            </h1>
            <p className="sub fade-up d2">
              Arma los planes desde el computador. Mira quién entrenó y quién no, sin preguntar.
              Tus alumnos registran cada serie en el teléfono y tú lo ves al instante.
            </p>
            <div className="hero-cta fade-up d3">
              <a
                className="btn btn-primary"
                href="https://wa.me/56949684325?text=Hola%2C%20quiero%20ver%20una%20demo%20de%20EliteFitness"
                target="_blank"
                rel="noopener noreferrer"
              >
                Agendar una demo
              </a>
              <Link className="btn btn-ghost" href="/signup">Crear mi cuenta</Link>
            </div>

            <div className="hero-stats fade-up d3">
              <div>
                <strong>841</strong>
                <span>ejercicios</span>
              </div>
              <div>
                <strong>∞</strong>
                <span>alumnos</span>
              </div>
              <div>
                <strong className="mono">$4.990</strong>
                <span>al mes</span>
              </div>
            </div>
          </div>

          <div className="hero-visual fade-up d2">
            <PhoneFrame src="/capturas/hoy.png" alt="La pantalla de hoy en la app del alumno, con sus ejercicios y las series registradas" priority />
          </div>
        </div>
      </header>
```

Agregar el import de `PhoneFrame` arriba del archivo, junto a los que ya están.

**El precio va en la portada a propósito:** un coach que lo descubre al final de la página se siente vendido.

- [ ] **Step 4: Estilos de las cifras**

Agregar a `globals.css`:

```css
/* ── Cifras de la portada ────────────────────────────── */
.hero-stats {
  display: flex;
  gap: 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  margin-top: 26px;
  max-width: 420px;
}
.hero-stats > div {
  flex: 1;
  text-align: center;
  padding: 14px 0;
}
.hero-stats > div + div { border-left: 1px solid var(--border); }
.hero-stats strong {
  display: block;
  font-family: var(--font-display), sans-serif;
  font-size: 26px;
  font-weight: 400;
  color: var(--text);
}
.hero-stats .mono { font-family: var(--font-mono), monospace; font-size: 22px; }
.hero-stats span {
  font-size: 10px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--text-muted);
}
```

Si `BarbellHero` queda sin uso en la página tras reemplazar el visual, **no borres el componente**: solo quita su import de `page.tsx` y dilo en el reporte.

- [ ] **Step 5: Verificar**

```bash
cd web && npm run build && npx vitest run
```

Esperado: compila sin errores y los tests siguen en verde.

- [ ] **Step 6: Commit**

```bash
git add web/src/app/page.tsx web/src/app/globals.css
git commit -m "feat(web): la portada le habla al coach, con la demo como acción principal"
```

---

### Task 3: Las tres secciones de prueba

Reemplazan "cómo funciona", "características" y "coach" por tres bloques con capturas reales. Un coach que ve la pantalla de "quién entrenó y quién no" entiende en dos segundos lo que tres párrafos no logran.

**Files:**
- Modify: `web/src/app/page.tsx` (los bloques `{/* CÓMO FUNCIONA */}`, `{/* CARACTERÍSTICAS */}` y `{/* COACH */}`, líneas ~57-154)
- Modify: `web/src/app/globals.css`

**Interfaces:**
- Consumes: `<PhoneFrame src alt priority? />` (Tarea 1)
- Produces: nada

- [ ] **Step 1: Reemplazar las tres secciones**

Sustituir los tres bloques por estos dos (el tercero, el de las capturas de la app, va en el Step 2):

```tsx
      {/* PRUEBA 1 — el panel */}
      <section className="section" id="panel">
        <div className="container split-section">
          <div>
            <span className="label">El panel</span>
            <h2>Sabe quién entrenó. Sin preguntar.</h2>
            <p className="sub">
              Tus alumnos aparecen separados entre los que necesitan atención y los que van al día.
              El umbral se ajusta al plan de cada uno: quien entrena dos veces por semana no te
              aparece como alerta por no entrenar un martes.
            </p>
            <ul className="ticks">
              <li>Días entrenados de los planificados, por alumno</li>
              <li>Cuándo entrenó por última vez</li>
              <li>Las notas que te dejó en cada sesión</li>
            </ul>
          </div>
          <div className="split-visual">
            <PhoneFrame src="/capturas/historial.png" alt="Calendario de un alumno con los días entrenados marcados" />
          </div>
        </div>
      </section>

      {/* PRUEBA 2 — el editor */}
      <section className="section">
        <div className="container split-section reverse">
          <div>
            <span className="label">El editor</span>
            <h2>Armas el plan una vez.</h2>
            <p className="sub">
              Desde el computador, con teclado y pantalla grande. Guarda un programa y reutilízalo
              con todos los alumnos que quieras; cada cambio llega al instante a su teléfono.
            </p>
            <ul className="ticks">
              <li>Biseries y triseries con un toque</li>
              <li>Semanas independientes, con descarga</li>
              <li>841 ejercicios en la biblioteca</li>
            </ul>
          </div>
          <div className="split-visual">
            <PhoneFrame src="/capturas/evolucion.png" alt="Pantalla de evolución con la carga por semana de un alumno" />
          </div>
        </div>
      </section>
```

- [ ] **Step 2: La sección de la app del alumno**

Agregar a continuación:

```tsx
      {/* PRUEBA 3 — lo que ve el alumno */}
      <section className="section" id="app">
        <div className="container">
          <div className="section-head">
            <span className="label">La app de tu alumno</span>
            <h2>Así te va a ver tu cliente.</h2>
            <p className="sub">
              Tu nombre, tu foto y tu Instagram dentro de la app que usa todos los días.
              Registra sus series, ve su progreso y te escribe sin salir de ahí.
            </p>
          </div>
          <div className="shots-row">
            <PhoneFrame src="/capturas/inicio.png" alt="Pantalla de inicio del alumno con sus días entrenados de la semana" />
            <PhoneFrame src="/capturas/perfil.png" alt="Perfil del alumno mostrando la ficha de su entrenador" />
          </div>
        </div>
      </section>
```

- [ ] **Step 3: Estilos de las secciones nuevas**

Agregar a `globals.css`:

```css
/* ── Secciones con captura al lado ───────────────────── */
.split-section {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 48px;
  align-items: center;
}
.split-section.reverse > *:first-child { order: 2; }
.split-visual { display: flex; justify-content: center; }
.ticks { list-style: none; padding: 0; margin: 20px 0 0; }
.ticks li {
  position: relative;
  padding: 9px 0 9px 22px;
  border-top: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 14px;
}
.ticks li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: var(--text-muted);
}
.shots-row {
  display: flex;
  gap: 28px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 32px;
}
@media (max-width: 720px) {
  .split-section { grid-template-columns: 1fr; gap: 28px; }
  .split-section.reverse > *:first-child { order: 0; }
}
```

- [ ] **Step 4: Eliminar los estilos que quedaron sin uso**

Las clases de las secciones que se fueron (`.steps`, `.step`, `.features`, `.feature`, `.coach-cta` y las que dependan de ellas) quedan huérfanas. **Antes de borrar cada una, comprueba con `grep` que no la use ninguna otra página** — `globals.css` es global y lo comparten el panel del coach y las demás rutas. Elimina solo las que no aparezcan en ningún `.tsx`.

- [ ] **Step 5: Verificar**

```bash
cd web && npm run build && npx vitest run
```

Esperado: compila sin errores, tests en verde.

```bash
grep -rn "steps\|feature\|coach-cta" src/app/globals.css
```

Esperado: solo lo que siga en uso real.

- [ ] **Step 6: Commit**

```bash
git add web/src/app/page.tsx web/src/app/globals.css
git commit -m "feat(web): tres secciones de prueba con capturas reales"
```

---

### Task 4: Precios, preguntas, el alumno y el cierre

**Files:**
- Modify: `web/src/app/page.tsx` (los bloques `{/* PRECIOS */}`, `{/* FAQ */}` y `{/* CTA FINAL */}`, líneas ~156-296)

**Interfaces:**
- Consumes: nada
- Produces: nada

- [ ] **Step 1: Los precios se conservan, el encabezado cambia**

**Los montos, los planes y sus límites no se tocan.** Solo se ajusta el texto de arriba para que hable de lo que el coach está comprando, no de "un entrenador o un gimnasio":

```tsx
          <div className="section-head">
            <span className="label">Precios</span>
            <h2>Clientes ilimitados, siempre.</h2>
            <p className="sub">
              El precio escala con cuántos entrenadores hay, no con cuántos clientes tengan.
              Cancela cuando quieras.
            </p>
          </div>
```

- [ ] **Step 2: Reorientar las preguntas frecuentes**

Las cuatro preguntas de hoy están escritas para el alumno ("¿Cómo consigo acceso a la app?", "¿Funciona si el gimnasio no tiene señal?", "¿En qué teléfonos está disponible?", "¿Puedo ver cuánto he mejorado?").

Reemplazarlas por las cuatro que se hace un coach antes de cambiarse de herramienta:

```tsx
            <details>
              <summary>¿Qué pasa con los planes que ya tengo en Excel?</summary>
              <p>
                Los armas una vez en el editor y quedan guardados como programas reutilizables.
                Escríbenos por WhatsApp y te ayudamos a cargar los primeros.
              </p>
            </details>
            <details>
              <summary>¿Mis alumnos tienen que pagar algo?</summary>
              <p>
                No. Ellos entran gratis por tu invitación; el plan lo pagas tú, y son ilimitados.
              </p>
            </details>
            <details>
              <summary>¿En qué teléfonos funciona?</summary>
              <p>
                Hoy en iPhone. La versión para Android está en camino. Tú administras todo desde
                el panel web, que funciona en cualquier computador.
              </p>
            </details>
            <details>
              <summary>¿Qué pasa si me arrepiento?</summary>
              <p>
                Cancelas cuando quieras, sin permanencia. Tus planes y el historial de tus alumnos
                siguen ahí si vuelves.
              </p>
            </details>
```

**Ojo:** verifica que `<details>` con `<summary>` sea la estructura que ya usa la página; si el marcado actual es distinto, conserva el que hay y cambia solo los textos.

- [ ] **Step 3: El cierre para el coach y el bloque del alumno**

Reemplazar el bloque `{/* CTA FINAL */}` por el cierre orientado al coach más el bloque del alumno:

```tsx
      {/* CIERRE — coach */}
      <section className="final-cta">
        <div className="container">
          <h2>Quince minutos y lo ves funcionando.</h2>
          <p className="sub">
            Te mostramos el panel con un alumno de prueba y respondemos lo que quieras preguntar.
          </p>
          <a
            className="btn btn-primary"
            href="https://wa.me/56949684325?text=Hola%2C%20quiero%20ver%20una%20demo%20de%20EliteFitness"
            target="_blank"
            rel="noopener noreferrer"
          >
            Agendar una demo
          </a>
        </div>
      </section>

      {/* ALUMNOS — al final a propósito: no son quien decide */}
      <section className="section" id="alumnos">
        <div className="container student-note">
          <span className="label">¿Eres alumno?</span>
          <p className="sub">
            Si tu entrenador te invitó, revisa tu correo: ahí está el enlace para crear tu
            contraseña y descargar la app. Si no te llegó, pídeselo a él.
          </p>
        </div>
      </section>
```

Y agregar a `globals.css`:

```css
.student-note {
  border-top: 1px solid var(--border);
  padding-top: 26px;
  text-align: center;
  color: var(--text-muted);
}
```

- [ ] **Step 4: Revisar el footer**

El footer ya tiene el WhatsApp `https://wa.me/56949684325`. Conservarlo. Revisar que sus enlaces internos no apunten a secciones que dejaron de existir (`#como-funciona`, `#caracteristicas`, `#coach`, `#descargar`) y actualizarlos a las nuevas (`#panel`, `#app`, `#precios`, `#alumnos`).

- [ ] **Step 5: Verificar que no quedaron anclas rotas**

```bash
cd web && grep -oE 'href="#[a-z-]+"' src/app/page.tsx | sort -u
grep -oE 'id="[a-z-]+"' src/app/page.tsx | sort -u
```

Esperado: cada `href="#x"` tiene su `id="x"` correspondiente. Un enlace del menú que no lleva a ninguna parte es de los defectos que más se notan.

```bash
npm run build && npx vitest run
```

- [ ] **Step 6: Commit**

```bash
git add web/src/app/page.tsx web/src/app/globals.css
git commit -m "feat(web): precios, preguntas y cierre orientados al coach"
```

---

### Task 5: Verificación

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Verificación local**

```bash
cd web && npm run build && npx vitest run && npx tsc --noEmit
```

Esperado: build correcto, tests en verde, tipos limpios.

- [ ] **Step 2: Confirmar el alcance**

```bash
cd /Users/sebastianazocarmondaca/Desktop/APP_trainer
git diff --stat sandbox -- trainer-app/ | tail -1
git diff --stat sandbox -- web/package.json
```

Esperado: el primero no debe incluir cambios de esta tarea (solo los del trabajo anterior de la app), y el segundo **sin salida** — ninguna dependencia nueva.

```bash
grep -n "var(--warning)" web/src/app/page.tsx
```

Esperado: **sin salida**. El ámbar no se usa en esta página.

- [ ] **Step 3: Mirarla de verdad**

El coordinador sube la rama y abre el preview de Vercel. Revisar:

1. **En el teléfono primero.** La mayoría de los coaches va a llegar desde un enlace que les mandaron por WhatsApp. Las capturas no pueden desbordar ni empujar el ancho de la página.
2. **El enlace de la demo**: debe abrir WhatsApp con el número correcto y el mensaje ya escrito.
3. **Los enlaces del menú y del footer**, uno por uno.
4. **Las capturas**: que se vean nítidas y que ninguna muestre datos de alumnos reales.
5. Con el navegador en 320px de ancho, que nada se corte.

---

## Fuera de alcance (explícito)

- La app (`trainer-app/`), incluida la tarjeta de "Energía y rendimiento", que usa un verde lima hardcodeado (`rgba(200,255,0,…)` en `Card.tsx`) y contradice el monocromo. Está anotado como deuda; se arregla aparte.
- `/signup`, `/login`, `/set-password`, la política de privacidad y el panel del coach.
- Cambiar precios, planes o el sistema de invitaciones.
- Traducciones, blog, casos de éxito o testimonios: no hay material real y no se inventa.
