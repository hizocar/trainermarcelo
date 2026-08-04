import Link from 'next/link';
import Logo from '@/components/Logo';

export const metadata = { title: 'Términos de uso' };

export default function TermsPage() {
  return (
    <>
      <nav className="nav">
        <div className="container nav-inner">
          <Link href="/" className="brand">
            <Logo />
          </Link>
        </div>
      </nav>

      <main className="container" style={{ paddingTop: 48, paddingBottom: 80, maxWidth: 760 }}>
        <span className="label accent">Legal</span>
        <h1 className="display" style={{ fontSize: 38, marginTop: 8, marginBottom: 24 }}>
          Términos de uso
        </h1>
        <p className="muted" style={{ marginBottom: 32 }}>Última actualización: agosto de 2026</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
          <section>
            <h2 style={{ fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>1. Qué es EliteFitness</h2>
            <p>
              EliteFitness es una plataforma para que entrenadores gestionen los planes de
              entrenamiento de sus clientes: app móvil para clientes y panel web para
              entrenadores y dueños de gimnasio. Al crear una cuenta, aceptas estos términos.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>2. Cuentas y planes</h2>
            <p>
              Cada cuenta de entrenador (&quot;gimnasio&quot;) tiene un plan con un cupo máximo de
              entrenadores. El dueño del gimnasio es responsable de invitar y gestionar a su
              equipo. Si superas el cupo de tu plan, deberás actualizarlo antes de invitar a
              más entrenadores.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>3. Precio y facturación</h2>
            <p>
              Los planes se cobran de forma recurrente (mensual o anual) a través de Flow, la
              pasarela de pago chilena. Los nuevos gimnasios acceden a 14 días de prueba; si no
              cancelas antes de que termine, se realiza el primer cobro automáticamente. Los
              precios están en pesos chilenos, IVA incluido, y pueden actualizarse — te
              avisaremos con anticipación si esto ocurre para tu plan.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>4. Cancelación</h2>
            <p>
              Puedes cancelar cuando quieras desde &quot;Mi suscripción&quot; en el panel web. La
              cancelación aplica al final del período ya pagado — seguirás teniendo acceso
              hasta esa fecha. No hacemos devoluciones de períodos ya iniciados. Al cancelar,
              tus entrenadores pierden acceso a la plataforma, pero <strong>el historial de
              entrenamiento de tus clientes se conserva</strong> — nada se borra.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>5. Uso aceptable</h2>
            <p>
              La plataforma es para uso profesional de entrenamiento físico. No está permitido
              usarla para dar indicaciones médicas, compartir contenido que no te pertenece sin
              autorización, ni intentar acceder a datos de otros gimnasios o entrenadores.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>6. Responsabilidad</h2>
            <p>
              EliteFitness es una herramienta de registro y seguimiento. La programación de
              entrenamiento y las recomendaciones que cada entrenador da a sus clientes son
              responsabilidad exclusiva del entrenador — no de la plataforma. Provista &quot;tal
              cual&quot;, sin garantías de disponibilidad ininterrumpida.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>7. Tus datos</h2>
            <p>
              Ver nuestra <Link href="/privacy" className="accent">Política de privacidad</Link> para
              el detalle de qué datos recolectamos y cómo los usamos.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>8. Cambios a estos términos</h2>
            <p>
              Si actualizamos estos términos de forma significativa, lo indicaremos en esta
              página con la fecha de la última actualización y, de ser necesario, te
              avisaremos por correo.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>9. Contacto</h2>
            <p>
              Preguntas sobre estos términos: <a href="mailto:hizocar@gmail.com" className="accent">hizocar@gmail.com</a>.
            </p>
          </section>
        </div>
      </main>

      <footer className="footer">
        <div className="container footer-bottom" style={{ marginTop: 0, paddingTop: 24 }}>
          <span>© {new Date().getFullYear()} EliteFitness</span>
          <Link href="/">← Volver al inicio</Link>
        </div>
      </footer>
    </>
  );
}
