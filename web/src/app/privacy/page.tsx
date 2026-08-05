import Link from 'next/link';
import Logo from '@/components/Logo';

export const metadata = { title: 'Política de privacidad' };

export default function PrivacyPage() {
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
          Política de privacidad
        </h1>
        <p className="muted" style={{ marginBottom: 32 }}>Última actualización: agosto de 2026</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
          <section>
            <h2 style={{ fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>1. Quiénes somos</h2>
            <p>
              EliteFitness es una aplicación de entrenamiento personalizado que conecta a
              entrenadores con sus clientes. Los entrenadores se registran directamente en{' '}
              <a href="https://elitefitapp.com/signup" className="accent">elitefitapp.com/signup</a>;
              sus clientes acceden por invitación del entrenador. Si tienes preguntas sobre
              esta política, escríbenos a{' '}
              <a href="mailto:hizocar@gmail.com" className="accent">hizocar@gmail.com</a>.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>2. Qué datos recolectamos</h2>
            <p>Solo recolectamos lo necesario para que la app cumpla su función:</p>
            <ul style={{ marginTop: 10, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li><b style={{ color: 'var(--text)' }}>Cuenta:</b> nombre, correo y contraseña (encriptada, nunca la vemos en texto plano).</li>
              <li><b style={{ color: 'var(--text)' }}>Entrenamiento:</b> planes, ejercicios, series, pesos y repeticiones que registras.</li>
              <li><b style={{ color: 'var(--text)' }}>Cuerpo y progreso:</b> medidas corporales y fotos de progreso que subas voluntariamente.</li>
              <li><b style={{ color: 'var(--text)' }}>Chat:</b> mensajes, fotos y notas de voz que envíes a tu entrenador o cliente.</li>
              <li><b style={{ color: 'var(--text)' }}>Bienestar:</b> tu nivel de energía diario, si eliges registrarlo.</li>
              <li><b style={{ color: 'var(--text)' }}>Notificaciones:</b> un identificador técnico del dispositivo para enviarte avisos push.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>3. Cómo se usan</h2>
            <p>
              Tus datos de entrenamiento y progreso los ve tu entrenador (o tus clientes, si
              eres entrenador) — es el propósito central de la app. No vendemos datos a
              terceros ni los usamos para publicidad. Las fotos y notas de voz del chat y de
              progreso se almacenan de forma privada; solo tú y la persona con la que
              compartes la conversación pueden acceder a ellas.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>4. Dónde se almacenan</h2>
            <p>
              Usamos Supabase (infraestructura sobre AWS) para la base de datos y el
              almacenamiento de archivos, con acceso restringido por fila: un entrenador solo
              puede ver los datos de sus propios clientes, y un gimnasio nunca ve los datos de
              otro gimnasio en la plataforma.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>5. Tus permisos en el dispositivo</h2>
            <p>La app pide acceso puntual, solo cuando lo necesitas:</p>
            <ul style={{ marginTop: 10, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li><b style={{ color: 'var(--text)' }}>Fotos:</b> para subir imágenes de ejercicios, tu avatar o fotos de progreso.</li>
              <li><b style={{ color: 'var(--text)' }}>Micrófono:</b> para grabar notas de voz en el chat con tu entrenador.</li>
              <li><b style={{ color: 'var(--text)' }}>Notificaciones:</b> para avisarte de mensajes nuevos y recordatorios de entrenamiento.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>6. Tus derechos</h2>
            <p>
              Puedes pedir acceso, corrección o eliminación de tus datos escribiendo a{' '}
              <a href="mailto:hizocar@gmail.com" className="accent">hizocar@gmail.com</a>.
              Al eliminar tu cuenta, borramos tu información personal salvo lo que debamos
              conservar por obligación legal.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>7. Menores de edad</h2>
            <p>
              EliteFitness está pensada para entrenadores y sus clientes adultos. Si un
              entrenador invita a un menor de edad bajo supervisión de un adulto responsable,
              es responsabilidad del entrenador contar con el consentimiento correspondiente.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>8. Cambios a esta política</h2>
            <p>
              Si actualizamos esta política de forma significativa, lo indicaremos en esta
              misma página con la fecha de la última actualización.
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
