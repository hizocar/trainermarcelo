'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import Logo from '@/components/Logo';

// Destino del link de invitación/recuperación de contraseña que manda
// Supabase Auth. El cliente de Supabase detecta la sesión a partir del
// token en la URL automáticamente (createBrowserClient), así que acá solo
// falta pedir la contraseña nueva y guardarla.
function SetPasswordInner() {
  const router = useRouter();
  const supabase = createClient();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setHasSession(true);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }

    setSaving(true);
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    if (updateErr) {
      setError(updateErr.message);
      setSaving(false);
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  if (checking) {
    return (
      <div className="auth-wrap">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="brand" style={{ marginBottom: 20, justifyContent: 'center' }}>
            <Logo />
          </div>
          <p className="muted">Verificando…</p>
        </div>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="auth-wrap">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="brand" style={{ marginBottom: 20, justifyContent: 'center' }}>
            <Logo />
          </div>
          <h1>Este link ya no es válido</h1>
          <p className="muted" style={{ fontSize: 14 }}>
            Puede haber expirado o ya haberse usado. Pide que te reenvíen la invitación, o inicia sesión si ya tienes contraseña.
          </p>
          <div style={{ marginTop: 20 }}>
            <Link href="/login" className="btn btn-primary" style={{ width: '100%' }}>
              IR A INICIAR SESIÓN
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand" style={{ marginBottom: 20 }}>
          <Logo />
        </div>
        <h1>Crea tu contraseña</h1>
        <p className="muted" style={{ fontSize: 14 }}>
          Último paso para activar tu cuenta de EliteFitness.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nueva contraseña</label>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              required
            />
          </div>
          <div className="field">
            <label>Repite la contraseña</label>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <button className="btn btn-primary" style={{ width: '100%', marginTop: 24 }} disabled={saving}>
            {saving ? 'GUARDANDO…' : 'ACTIVAR CUENTA'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordInner />
    </Suspense>
  );
}
