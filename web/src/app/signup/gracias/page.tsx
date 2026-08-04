import Link from 'next/link';
import Logo from '@/components/Logo';

export const metadata = { title: 'Pago confirmado' };

export default function SignupThanksPage() {
  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="brand" style={{ marginBottom: 20, justifyContent: 'center' }}>
          <Logo />
        </div>
        <h1>¡Pago confirmado!</h1>
        <p className="muted" style={{ fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
          Te acabamos de enviar un correo para que crees tu contraseña y actives tu cuenta.
          Revisa tu bandeja de entrada (y spam, por si acaso) en los próximos minutos.
        </p>
        <div style={{ marginTop: 24 }}>
          <Link href="/login" className="btn btn-primary" style={{ width: '100%' }}>
            YA TENGO MI CONTRASEÑA
          </Link>
        </div>
      </div>
    </div>
  );
}
