'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { firstToken } from '@/lib/env';

// Página a la que Flow redirige al terminar el registro de tarjeta
// (url_return de /customer/register). Acá recién se crea la suscripción
// real y la cuenta — si el usuario llegó hasta acá es porque su tarjeta
// quedó registrada en Flow.
function EnrollReturnInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const registerToken = params.get('token');
    if (!registerToken) {
      setStatus('error');
      setError('Falta el token de registro de Flow.');
      return;
    }

    fetch(`${firstToken(process.env.NEXT_PUBLIC_SUPABASE_URL)}/functions/v1/confirm-signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: firstToken(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      },
      body: JSON.stringify({ registerToken }),
    })
      .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        if (!ok || body.error) {
          setStatus('error');
          setError(body.error ?? 'No se pudo confirmar el alta.');
          return;
        }
        router.replace('/signup/gracias');
      })
      .catch((err) => {
        setStatus('error');
        setError(err.message ?? 'Error de conexión.');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ maxWidth: 460, textAlign: 'center' }}>
        <div className="brand" style={{ marginBottom: 20, justifyContent: 'center' }}>
          <Logo />
        </div>
        {status === 'loading' ? (
          <>
            <h1>Confirmando tu alta…</h1>
            <p className="muted" style={{ fontSize: 14 }}>
              Estamos activando tu suscripción con Flow. No cierres esta página.
            </p>
          </>
        ) : (
          <>
            <h1>No pudimos confirmar el pago</h1>
            <p className="muted" style={{ fontSize: 14 }}>{error}</p>
            <Link href="/signup" className="btn btn-primary" style={{ marginTop: 16, display: 'inline-flex' }}>
              INTENTAR NUEVAMENTE
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function EnrollReturnPage() {
  return (
    <Suspense fallback={null}>
      <EnrollReturnInner />
    </Suspense>
  );
}
