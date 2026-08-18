import Link from 'next/link';
import Logo from '@/components/Logo';
import PhoneFrame from '@/components/PhoneFrame';

export default function LandingPage() {
  return (
    <>
      <nav className="nav">
        <div className="container nav-inner">
          <a href="#" className="brand">
            <Logo />
          </a>
          <div className="nav-links">
            <a href="#panel">Cómo funciona</a>
            <a href="#app">La app de tu alumno</a>
            <a href="#precios">Precios</a>
          </div>
          <Link href="/login" className="btn btn-ghost" style={{ padding: '10px 18px' }}>
            Acceso coach
          </Link>
        </div>
      </nav>

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

      {/* PRECIOS */}
      <section className="section" id="precios">
        <div className="container">
          <div className="section-head">
            <span className="label">Precios</span>
            <h2>Clientes ilimitados, siempre.</h2>
            <p className="sub">
              El precio escala con cuántos entrenadores hay, no con cuántos clientes tengan.
              Cancela cuando quieras.
            </p>
          </div>

          <div className="price-grid">
            <div className="price-card">
              <span className="price-name">Solo</span>
              <span className="price-seats">1 entrenador</span>
              <span className="price-value">$4.990<small>/mes</small></span>
              <span className="price-annual">$49.900/año · 2 meses gratis</span>
              <ul>
                <li>Para el entrenador independiente</li>
                <li>Clientes ilimitados</li>
                <li>App iOS + panel web</li>
                <li>Historial, progreso y calendario</li>
              </ul>
              <Link className="btn btn-ghost" href="/signup?plan=solo">Empezar</Link>
            </div>

            <div className="price-card">
              <span className="price-name">Starter</span>
              <span className="price-seats">2–3 entrenadores</span>
              <span className="price-value">$9.990<small>/mes</small></span>
              <span className="price-annual">$99.900/año · 2 meses gratis</span>
              <ul>
                <li>Todo lo de Solo</li>
                <li>Cada coach ve solo a sus clientes</li>
                <li>Biblioteca de ejercicios del equipo</li>
              </ul>
              <Link className="btn btn-ghost" href="/signup?plan=starter">Empezar</Link>
            </div>

            <div className="price-card rec">
              <span className="price-flag">Más elegido</span>
              <span className="price-name">Growth</span>
              <span className="price-seats">4–8 entrenadores</span>
              <span className="price-value">$19.990<small>/mes</small></span>
              <span className="price-annual">$199.900/año · 2 meses gratis</span>
              <ul>
                <li>Todo lo de Starter</li>
                <li><b>Panel con tu marca</b> — logo y color del gimnasio</li>
                <li>Vista del dueño con todo el equipo</li>
                <li>Soporte prioritario</li>
              </ul>
              <Link className="btn btn-primary" href="/signup?plan=growth">Empezar</Link>
            </div>

            <div className="price-card">
              <span className="price-name">Pro</span>
              <span className="price-seats">9–20 entrenadores</span>
              <span className="price-value">$39.990<small>/mes</small></span>
              <span className="price-annual">$399.900/año · 2 meses gratis</span>
              <ul>
                <li>Todo lo de Growth</li>
                <li>Reportes de uso por entrenador</li>
                <li>Onboarding asistido del equipo</li>
              </ul>
              <Link className="btn btn-ghost" href="/signup?plan=pro">Empezar</Link>
            </div>

            <div className="price-card">
              <span className="price-name">Enterprise</span>
              <span className="price-seats">20+ · multi-sede</span>
              <span className="price-value" style={{ fontSize: 22 }}>A medida</span>
              <span className="price-annual">&nbsp;</span>
              <ul>
                <li>Entrenadores ilimitados</li>
                <li><b>Marca 100% propia</b> — ícono y nombre en el App Store</li>
                <li>Múltiples sedes en una cuenta</li>
              </ul>
              <a className="btn btn-ghost" href="mailto:hizocar@gmail.com?subject=Quiero%20un%20plan%20Enterprise">Conversemos</a>
            </div>
          </div>

          <p className="price-note">
            Cupo extra $1.490/entrenador/mes sobre el límite del plan · Precios en pesos chilenos, IVA incluido
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="section" id="faq">
        <div className="container">
          <div className="section-head">
            <span className="label accent">Preguntas frecuentes</span>
            <h2>Dudas rápidas</h2>
          </div>
          <div className="faq">
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
          </div>
        </div>
      </section>

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

      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div>
              <div className="brand">
                <Logo />
              </div>
              <p className="tagline">
                Entrenamiento personalizado con seguimiento real. Cada serie cuenta.
              </p>
            </div>
            <div className="footer-col">
              <h4>Producto</h4>
              <a href="#panel">Cómo funciona</a>
              <a href="#app">La app de tu alumno</a>
              <a href="#precios">Precios</a>
              <a href="#alumnos">¿Eres alumno?</a>
            </div>
            <div className="footer-col">
              <h4>Coaches</h4>
              <a href="#panel">Panel para coaches</a>
              <Link href="/login">Iniciar sesión</Link>
            </div>
            <div className="footer-col">
              <h4>Contacto</h4>
              <a href="mailto:hizocar@gmail.com">hizocar@gmail.com</a>
              <a href="https://wa.me/56949684325" target="_blank" rel="noopener noreferrer">WhatsApp +56 9 4968 4325</a>
              <span className="muted" style={{ fontSize: 13 }}>Coach fundador: Marcelo Herrera</span>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} EliteFitness · Entrenamiento personalizado</span>
            <span style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <Link href="/privacy">Privacidad</Link>
              <Link href="/terms">Términos</Link>
              Hecho con 🏋️ en Chile
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}
