import Link from 'next/link';
import Logo from '@/components/Logo';
import { signOut } from '@/app/actions';

export const metadata = { title: 'La web es para coaches' };

// Un alumno que entra a la web: aquí no hay nada para él (la web es solo para
// coaches). En vez de rebotarlo al login sin explicación, le decimos dónde ir.
export default function SoloCoachesPage() {
  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ maxWidth: 460 }}>
        <div className="brand" style={{ marginBottom: 20 }}>
          <Logo />
        </div>
        <h1>Tu entrenamiento está en la app</h1>
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
          La web de EliteFitness es el panel de los coaches. Tu plan, tus series y tu
          progreso los ves en la app, con esta misma cuenta.
        </p>
        <a className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} href="https://apps.apple.com/app/id6788209434">
          DESCARGAR PARA IPHONE
        </a>
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>La versión para Android llega pronto.</p>
        <form action={signOut}>
          <button type="submit" className="btn btn-ghost" style={{ width: '100%', marginTop: 14 }}>SALIR</button>
        </form>
        <p style={{ marginTop: 14, fontSize: 13 }}>
          <Link href="/" className="muted">← Volver al inicio</Link>
        </p>
      </div>
    </div>
  );
}
