import Link from 'next/link';

export default function LandingPage() {
  return (
    <>
      <nav className="nav">
        <div className="container nav-inner">
          <div className="brand">
            <span className="brand-dot" />
            Marcelo Herrera
          </div>
          <Link href="/login" className="btn btn-ghost" style={{ padding: '10px 18px' }}>
            SOY COACH · ENTRAR
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <header className="hero">
        <div className="hero-glow" />
        <div className="container hero-grid">
          <div>
            <span className="label">Entrenamiento personalizado</span>
            <h1>
              Tu plan.<br />
              Tu progreso.<br />
              <em>En serio.</em>
            </h1>
            <p className="sub">
              Registra cada serie, sigue tu evolución semana a semana y entrena con un plan
              diseñado por tu coach — no una rutina genérica de internet.
            </p>
            <div className="hero-cta">
              <a className="btn btn-primary" href="#descargar">DESCARGAR LA APP</a>
              <Link className="btn btn-ghost" href="/login">ACCESO COACH</Link>
            </div>
            <p className="hero-note">Disponible para iPhone · Android en camino</p>
          </div>

          <div className="phone">
            <div className="notch" />
            <span className="phone-label">VIE 18 JUL</span>
            <span className="phone-title">Sebastián</span>
            <div className="phone-ring" />
            <div className="phone-row">
              <div>
                <strong>Press banca</strong>
                <br />
                <small>Pecho · 3 series · 8-12</small>
              </div>
              <div className="phone-check">✓</div>
            </div>
            <div className="phone-row">
              <div>
                <strong>Remo con barra</strong>
                <br />
                <small>Espalda · 4 series · 10</small>
              </div>
              <div className="phone-check">✓</div>
            </div>
          </div>
        </div>
      </header>

      {/* FEATURES */}
      <section className="section">
        <div className="container">
          <span className="label accent">Por qué funciona</span>
          <h2>Todo lo que necesitas para avanzar</h2>
          <p className="lead">
            Pensada con un entrenador real para que cada sesión cuente y nada se pierda.
          </p>
          <div className="features">
            <div className="feature">
              <div className="ico">🏋️</div>
              <h3>Planes por objetivo</h3>
              <p>Tu coach arma tus días, ejercicios, series y objetivos de reps. Tú solo entrenas.</p>
            </div>
            <div className="feature">
              <div className="ico">📈</div>
              <h3>Progreso real</h3>
              <p>Cada peso y repetición queda registrado. Mira tu evolución por ejercicio y por semana.</p>
            </div>
            <div className="feature">
              <div className="ico">🔥</div>
              <h3>Historial completo</h3>
              <p>Calendario de entrenamientos, histórico de cargas y tu mejor marca siempre a mano.</p>
            </div>
            <div className="feature">
              <div className="ico">💬</div>
              <h3>Conectado a tu coach</h3>
              <p>Deja notas de cada sesión y chatea con tu entrenador cuando lo necesites.</p>
            </div>
            <div className="feature">
              <div className="ico">⏱️</div>
              <h3>Descanso y tempo</h3>
              <p>Temporizador de descanso, RIR y tempo objetivo para entrenar con precisión.</p>
            </div>
            <div className="feature">
              <div className="ico">📶</div>
              <h3>Funciona sin señal</h3>
              <p>Registra en el gimnasio aunque no haya internet: se sincroniza solo al volver la señal.</p>
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
              <h2>Gestiona a tus clientes desde el computador</h2>
              <p className="lead">
                Crea y edita los planes de todos tus clientes desde una pantalla grande,
                con teclado y sin fricción. Los cambios llegan al instante a su app.
              </p>
            </div>
            <Link className="btn btn-primary" href="/login">ENTRAR AL PANEL</Link>
          </div>
        </div>
      </section>

      {/* DESCARGAR */}
      <section className="section" id="descargar">
        <div className="container" style={{ textAlign: 'center' }}>
          <h2>Empieza hoy</h2>
          <p className="lead" style={{ margin: '0 auto 28px' }}>
            Pídele a tu coach una invitación y descarga la app para comenzar a registrar tu progreso.
          </p>
          <a className="btn btn-primary" href="mailto:hizocar@gmail.com?subject=Quiero%20la%20app">
            SOLICITAR ACCESO
          </a>
        </div>
      </section>

      <footer className="footer">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: 12 }}>
          <span>© {new Date().getFullYear()} Marcelo Herrera · Entrenamiento personalizado</span>
          <Link href="/login" className="muted">Acceso coach</Link>
        </div>
      </footer>
    </>
  );
}
