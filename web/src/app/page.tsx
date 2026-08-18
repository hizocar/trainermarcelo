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

      {/* CÓMO FUNCIONA */}
      <section className="section" id="como-funciona">
        <div className="container">
          <div className="section-head">
            <span className="label accent">Cómo funciona</span>
            <h2>De la invitación al primer PR</h2>
            <p className="lead">Tres pasos y estás entrenando con seguimiento real.</p>
          </div>
          <div className="steps">
            <div className="step">
              <div className="step-num">1</div>
              <h3>Tu coach te invita</h3>
              <p>Recibes tu acceso personal. Nada de registros abiertos: aquí entrenas acompañado desde el día uno.</p>
            </div>
            <div className="step">
              <div className="step-num">2</div>
              <h3>Entrenas con tu plan</h3>
              <p>Días, ejercicios, series y objetivos definidos por tu coach. Registra peso y reps en segundos, incluso sin señal en el gimnasio.</p>
            </div>
            <div className="step">
              <div className="step-num">3</div>
              <h3>Ves tu progreso</h3>
              <p>Gráficos de carga total, mejores marcas, calendario de entrenamientos y sugerencias de progresión automáticas.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CARACTERÍSTICAS */}
      <section className="section" id="caracteristicas">
        <div className="container">
          <div className="section-head">
            <span className="label accent">Por qué funciona</span>
            <h2>Todo lo que necesitas para avanzar</h2>
            <p className="lead">
              Pensada junto a un entrenador real para que cada sesión cuente y nada se pierda.
            </p>
          </div>
          <div className="features">
            <div className="feature">
              <div className="ico">🏋️</div>
              <h3>Planes por objetivo</h3>
              <p>Tu coach arma tus días, ejercicios, series, tempo, descanso y RIR. Tú solo entrenas.</p>
            </div>
            <div className="feature">
              <div className="ico">📈</div>
              <h3>Progreso real</h3>
              <p>Cada peso y repetición queda registrado. Carga total por semana, tendencias y mejores marcas por ejercicio.</p>
            </div>
            <div className="feature">
              <div className="ico">🗓️</div>
              <h3>Historial completo</h3>
              <p>Calendario estilo anillos con cada sesión: toca un día y revisa exactamente qué levantaste.</p>
            </div>
            <div className="feature">
              <div className="ico">💬</div>
              <h3>Conectado a tu coach</h3>
              <p>Chat integrado con fotos y notas de voz, más notas por sesión para que nada se quede en el aire.</p>
            </div>
            <div className="feature">
              <div className="ico">⏱️</div>
              <h3>Descanso y precisión</h3>
              <p>Temporizador de descanso con aviso, RIR objetivo y sugerencias de progresión cuando completas el rango.</p>
            </div>
            <div className="feature">
              <div className="ico">📶</div>
              <h3>Funciona sin señal</h3>
              <p>Registra en el gimnasio aunque no haya internet: todo se sincroniza solo cuando vuelve la señal.</p>
            </div>
          </div>
        </div>
      </section>

      {/* COACH */}
      <section className="section" id="coach">
        <div className="container">
          <div className="coach-band">
            <div>
              <span className="label accent">Para entrenadores</span>
              <h2>Tu negocio, bajo control</h2>
              <ul className="coach-list">
                <li>Edita los planes de todos tus clientes desde el computador, con teclado y pantalla grande.</li>
                <li>Monitorea el progreso por día del plan y detecta solapes de volumen por grupo muscular.</li>
                <li>Lee las notas de cada sesión y responde por chat sin salir de la app.</li>
                <li>Cada cambio llega al instante al teléfono de tu cliente.</li>
              </ul>
            </div>
            <div className="coach-cta">
              <span className="big">Panel web para coaches</span>
              <span className="muted" style={{ fontSize: 14 }}>
                Entra con las mismas credenciales de tu app.
              </span>
              <Link className="btn btn-primary" href="/login">Entrar al panel</Link>
            </div>
          </div>
        </div>
      </section>

      {/* PRECIOS */}
      <section className="section" id="precios">
        <div className="container">
          <div className="section-head">
            <span className="label accent">Precios</span>
            <h2>Para un entrenador o para todo un gimnasio</h2>
            <p className="lead">
              El precio escala con cuántos <em style={{ fontStyle: 'normal', color: 'var(--text)' }}>entrenadores</em> hay,
              no con cuántos clientes tengan — clientes siempre ilimitados. Cancela cuando quieras.
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
              <summary>¿Cómo consigo acceso a la app?</summary>
              <p>
                Si eres entrenador, te registras directo en la sección de precios de arriba. Si
                eres cliente, el acceso es por invitación de tu entrenador — pídesela a él.
              </p>
            </details>
            <details>
              <summary>¿Funciona si el gimnasio no tiene señal?</summary>
              <p>
                Sí. Puedes registrar tus series sin conexión: la app guarda todo en tu teléfono y lo
                sube automáticamente cuando vuelve el internet.
              </p>
            </details>
            <details>
              <summary>¿En qué teléfonos está disponible?</summary>
              <p>
                Hoy está disponible para iPhone (vía TestFlight). La versión para Android está en
                camino.
              </p>
            </details>
            <details>
              <summary>¿Puedo ver cuánto he mejorado?</summary>
              <p>
                Cada ejercicio tiene su histórico: carga total por semana, tu mejor marca y el
                detalle de cada serie que registraste, desde el primer día.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="final-cta" id="descargar">
        <div className="container">
          <h2>Empieza <span className="accent">hoy</span></h2>
          <p className="lead">
            Pídele una invitación a tu coach y descarga la app para comenzar a registrar tu
            progreso de verdad.
          </p>
          <a className="btn btn-primary" href="mailto:hizocar@gmail.com?subject=Quiero%20entrenar%20con%20la%20app">
            Solicitar acceso
          </a>
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
              <a href="#como-funciona">Cómo funciona</a>
              <a href="#caracteristicas">Características</a>
              <a href="#descargar">Descargar</a>
            </div>
            <div className="footer-col">
              <h4>Coaches</h4>
              <a href="#coach">Panel para coaches</a>
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
