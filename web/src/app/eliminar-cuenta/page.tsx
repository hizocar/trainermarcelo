import Link from 'next/link';
import Logo from '@/components/Logo';

// Página PÚBLICA para pedir el borrado de la cuenta. Google Play la exige como
// URL en el formulario de Seguridad de los datos: tiene que servir sin tener
// la app instalada ni haber iniciado sesión.

export const metadata = {
  title: 'Eliminar tu cuenta',
  description: 'Cómo eliminar tu cuenta de EliteFitness y qué datos se borran.',
};

const CORREO = 'hizocar@gmail.com';

export default function EliminarCuentaPage() {
  const estiloH2 = { fontSize: 18, color: 'var(--text)', marginBottom: 8 } as const;
  const estiloLista = { marginTop: 10, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 } as const;

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
        <span className="label accent">Tu cuenta</span>
        <h1 className="display" style={{ fontSize: 38, marginTop: 8, marginBottom: 24 }}>
          Eliminar tu cuenta de EliteFitness
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
          <section>
            <h2 style={estiloH2}>Desde la app (lo más rápido)</h2>
            <ol style={estiloLista}>
              <li>Abre EliteFitness e inicia sesión.</li>
              <li>Ve a <b style={{ color: 'var(--text)' }}>Perfil → Ajustes</b>.</li>
              <li>Al final, toca <b style={{ color: 'var(--text)' }}>Eliminar mi cuenta</b> y confirma.</li>
            </ol>
            <p style={{ marginTop: 10 }}>La cuenta se borra en ese momento.</p>
          </section>

          <section>
            <h2 style={estiloH2}>Sin la app</h2>
            <p>
              Escríbenos a{' '}
              <a href={`mailto:${CORREO}?subject=Eliminar%20mi%20cuenta`} className="accent">{CORREO}</a>{' '}
              desde el correo con que te registraste, con el asunto &quot;Eliminar mi cuenta&quot;.
              La eliminamos en un plazo máximo de 30 días y te confirmamos por el mismo medio.
            </p>
          </section>

          <section>
            <h2 style={estiloH2}>Qué se borra</h2>
            <ul style={estiloLista}>
              <li>Tu perfil: nombre, correo y foto.</li>
              <li>Tu plan, tu historial de entrenamientos, tus medidas y tu ficha de salud.</li>
              <li>Tus fotos de progreso, tus mensajes y tus notas de voz.</li>
              <li>Si eres entrenador: tus programas, tu biblioteca de ejercicios y tus videos.</li>
            </ul>
          </section>

          <section>
            <h2 style={estiloH2}>Qué se conserva</h2>
            <ul style={estiloLista}>
              <li>
                Si eres entrenador, <b style={{ color: 'var(--text)' }}>tus alumnos conservan su cuenta, su plan y su historial</b>:
                son sus datos. Quedan sin entrenador asignado.
              </li>
              <li>Lo que la ley nos obligue a guardar (por ejemplo, registros de pagos), por el plazo que exija.</li>
            </ul>
          </section>

          <section>
            <h2 style={estiloH2}>Si tienes una suscripción activa</h2>
            <p>
              Cancélala primero desde tu panel en elitefitapp.com. Mientras haya un cobro
              activo, la app te pedirá cancelarlo antes de eliminar la cuenta, para que no
              se te siga cobrando.
            </p>
          </section>
        </div>
      </main>

      <footer className="footer">
        <div className="container footer-bottom" style={{ marginTop: 0, paddingTop: 24 }}>
          <span>© {new Date().getFullYear()} EliteFitness</span>
          <Link href="/privacy">Política de privacidad</Link>
        </div>
      </footer>
    </>
  );
}
