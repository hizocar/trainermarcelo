import type { Metadata } from 'next';
import Link from 'next/link';
import Logo from '@/components/Logo';

export const metadata: Metadata = {
  title: 'Súmate como coach — EliteFitness',
  description:
    'Cuenta gratis, alumnos que ya están buscando entrenador, y un mes de regalo con el panel completo al tomar tu primera solicitud.',
  openGraph: {
    title: 'Los alumnos ya están buscando. Falta que te encuentren.',
    description: 'Cuenta gratis para coaches: postula a solicitudes de alumnos reales y gana un mes del panel completo.',
  },
};

// La página que le vende el marketplace al coach. La landing principal vende
// el software al coach que ya tiene alumnos y paga; esta le habla al coach que
// quiere ALUMNOS. Mismo kit visual (monocromo, el ámbar solo en la acción).
export default function UnetePage() {
  return (
    <>
      <nav className="nav">
        <div className="container nav-inner">
          <Link href="/" className="brand"><Logo /></Link>
          <div className="nav-links">
            <a href="#como">Cómo funciona</a>
            <a href="#regalo">El mes de regalo</a>
          </div>
          <Link href="/login" className="btn btn-ghost" style={{ padding: '10px 18px' }}>
            Acceso coach
          </Link>
        </div>
      </nav>

      <header className="hero">
        <div className="container hero-grid">
          <div>
            <span className="hero-badge fade-up">Para coaches · gratis</span>
            <h1 className="fade-up d1">
              Los alumnos ya están buscando.<br />
              <em>Falta que te encuentren.</em>
            </h1>
            <p className="sub fade-up d2" style={{ maxWidth: 560 }}>
              Personas reales publican qué buscan y dejan su WhatsApp. Tú postulas,
              les escribes, y cierras. Sin tarjeta, sin mensualidad: tu cuenta del
              marketplace es gratis.
            </p>
            <div className="hero-cta fade-up d3">
              <Link className="btn btn-primary" href="/signup?plan=free">Crear mi cuenta gratis</Link>
              <Link className="btn btn-ghost" href="/coaches">Ver el directorio</Link>
            </div>
          </div>

          {/* La misma tarjeta que muestran los avisos de Meta: el aviso promete
              una solicitud real, y la página que abre la muestra. El ámbar acá
              es legítimo — le está diciendo al coach "esto te pediría acción". */}
          <div className="hero-visual fade-up d2" aria-hidden>
            <div style={{
              border: '1px solid var(--warning)', borderRadius: 16,
              background: 'var(--card)', padding: 24, maxWidth: 420,
            }}>
              <p className="label" style={{ color: 'var(--warning)' }}>
                Te pidieron a ti — postula sin esperar
              </p>
              <p className="label" style={{ marginTop: 14 }}>Providencia · Presencial</p>
              <p style={{ marginTop: 10, fontSize: 17, lineHeight: 1.55 }}>
                “Quiero volver a entrenar después de una lesión. Puedo martes y
                jueves por la mañana.”
              </p>
              <p className="mono muted" style={{ fontSize: 12, marginTop: 14, letterSpacing: 1 }}>
                HACE 2 H · QUEDAN 2 DE 3 CUPOS
              </p>
              <div style={{
                marginTop: 16, background: 'var(--accent)', color: 'var(--bg)',
                textAlign: 'center', fontWeight: 800, fontSize: 13,
                letterSpacing: 2, padding: 14, borderRadius: 10,
              }}>
                POSTULAR Y VER SU WHATSAPP
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="section" id="como">
        <div className="container">
          <div className="section-head">
            <span className="label">Cómo funciona</span>
            <h2>Cuatro pasos, cero letra chica.</h2>
          </div>

          <div style={{ display: 'grid', gap: 16, maxWidth: 640 }}>
            {[
              ['1', 'Crea tu cuenta gratis', 'Nombre, correo y el nombre de tu negocio. Sin tarjeta.'],
              ['2', 'Te aprobamos', 'Revisamos cada perfil a mano: el directorio vale porque no entra cualquiera. Te avisamos por correo.'],
              ['3', 'Postula a solicitudes reales', 'Gente que ya dijo qué busca, en qué comuna y cuándo puede. Postulas y ves su WhatsApp: el primer mensaje lo mandas tú.'],
              ['4', 'Toma tu primera solicitud', 'Cuando un alumno te elige, marca "lo tomé" — y ahí empieza tu mes de regalo.'],
            ].map(([n, titulo, texto]) => (
              <article key={n} style={{
                border: '1px solid var(--border)', borderRadius: 12,
                padding: 20, background: 'var(--card)', display: 'flex', gap: 16,
              }}>
                <span className="mono" style={{ fontSize: 22, opacity: 0.4 }}>{n}</span>
                <div>
                  <strong>{titulo}</strong>
                  <p className="sub" style={{ marginTop: 4 }}>{texto}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="regalo">
        <div className="container split-section">
          <div>
            <span className="label">El mes de regalo</span>
            <h2>Tu primer alumno te regala el panel.</h2>
            <p className="sub">
              Al tomar tu primera solicitud se abre un mes completo del panel de
              coach: planes desde el computador, la app para tu alumno con cada
              serie registrada, y tú viendo quién entrenó sin preguntar.
            </p>
            <ul className="ticks">
              <li>Un mes con todo, sin tarjeta</li>
              <li>Después decides: los planes parten en $4.990/mes</li>
              <li>Si no sigues, tu perfil del directorio no desaparece</li>
            </ul>
          </div>
          <div>
            <span className="label">Mientras tanto</span>
            <h2 style={{ fontSize: 22 }}>Tu perfil trabaja solo.</h2>
            <p className="sub">
              Tu página pública —tu bio, especialidades, comunas— queda en el
              directorio y con URL propia para compartir en Instagram. Si un
              cliente te pide por nombre, esa solicitud te llega destacada y
              postulas al tiro, sin esperar.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ textAlign: 'center' }}>
          <h2>¿Listo?</h2>
          <p className="sub" style={{ margin: '8px auto 24px', maxWidth: 420 }}>
            La cuenta se crea en un minuto. La aprobación suele salir el mismo día.
          </p>
          <Link className="btn btn-primary" href="/signup?plan=free">Crear mi cuenta gratis</Link>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <p className="muted" style={{ fontSize: 13 }}>
            EliteFitness · <Link href="/">Inicio</Link> · <Link href="/coaches">Directorio</Link> · <Link href="/terms">Términos</Link>
          </p>
        </div>
      </footer>
    </>
  );
}
