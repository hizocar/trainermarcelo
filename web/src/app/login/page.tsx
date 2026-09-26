'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import Logo from '@/components/Logo';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError || !data.user) {
      setError('Correo o contraseña incorrectos.');
      setLoading(false);
      return;
    }

    // Quién entra a qué lo decide el guardia (requireCoach): un coach con el
    // registro a medias va a /bienvenida, uno con el perfil incompleto a
    // /perfil y un alumno a /solo-coaches. Antes el login rechazaba todo lo que
    // no fuera coach — y un coach nuevo que dejó el registro a medias (su cuenta
    // aún figura como alumno) no podía retomarlo nunca.
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand" style={{ marginBottom: 20 }}>
          <Logo />
        </div>
        <h1>Panel de coach</h1>
        <p className="muted" style={{ fontSize: 14 }}>Gestiona los planes de tus clientes.</p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Correo</label>
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              required
            />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <button className="btn btn-primary" style={{ width: '100%', marginTop: 24 }} disabled={loading}>
            {loading ? 'ENTRANDO…' : 'ENTRAR'}
          </button>
        </form>

        <p style={{ marginTop: 20, fontSize: 13 }}>
          <Link href="/" className="muted">← Volver al inicio</Link>
        </p>
      </div>
    </div>
  );
}
