'use client';

import { useState } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';

const PLANS = [
  { tier: 'solo', name: 'Solo', seats: '1 entrenador', monthly: 4990, annual: 49900 },
  { tier: 'starter', name: 'Starter', seats: '2–3 entrenadores', monthly: 9990, annual: 99900 },
  { tier: 'growth', name: 'Growth', seats: '4–8 entrenadores', monthly: 19990, annual: 199900 },
  { tier: 'pro', name: 'Pro', seats: '9–20 entrenadores', monthly: 39990, annual: 399900 },
] as const;

const clp = (n: number) => `$${n.toLocaleString('es-CL')}`;

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [gymName, setGymName] = useState('');
  const [tier, setTier] = useState<(typeof PLANS)[number]['tier']>('solo');
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !gymName.trim()) {
      setError('Completa todos los campos.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/start-signup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
          },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            gymName: gymName.trim(),
            planTier: tier,
            billing,
          }),
        },
      );
      const result = await res.json();
      if (!res.ok || result.error) {
        setError(result.error ?? 'No se pudo iniciar el pago.');
        setLoading(false);
        return;
      }
      window.location.href = result.url;
    } catch (err: any) {
      setError(err.message ?? 'Error de conexión.');
      setLoading(false);
    }
  }

  const selected = PLANS.find((p) => p.tier === tier)!;
  const price = billing === 'monthly' ? selected.monthly : selected.annual;

  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ maxWidth: 460 }}>
        <div className="brand" style={{ marginBottom: 20 }}>
          <Logo />
        </div>
        <h1>Crea tu cuenta</h1>
        <p className="muted" style={{ fontSize: 14 }}>
          Empieza a gestionar tu negocio de entrenamiento hoy.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Tu nombre</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Camila Rojas" />
          </div>
          <div className="field">
            <label>Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="camila@email.com" />
          </div>
          <div className="field">
            <label>Nombre de tu negocio</label>
            <input className="input" value={gymName} onChange={(e) => setGymName(e.target.value)} placeholder="ej: Camila Rojas Training" />
          </div>

          <div className="field">
            <label>Plan</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {PLANS.map((p) => (
                <button
                  type="button"
                  key={p.tier}
                  onClick={() => setTier(p.tier)}
                  className="btn"
                  style={{
                    justifyContent: 'flex-start', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
                    padding: '10px 14px', textTransform: 'none', letterSpacing: 0,
                    background: tier === p.tier ? 'var(--accent)' : 'var(--surface)',
                    color: tier === p.tier ? 'var(--bg)' : 'var(--text)',
                    border: `1px solid ${tier === p.tier ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  <strong style={{ fontSize: 13 }}>{p.name}</strong>
                  <span style={{ fontSize: 11, opacity: 0.8 }}>{p.seats}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Facturación</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setBilling('monthly')}
                className="btn btn-ghost"
                style={{ flex: 1, padding: '9px', fontSize: 11, background: billing === 'monthly' ? 'var(--surface)' : 'transparent' }}
              >
                Mensual
              </button>
              <button
                type="button"
                onClick={() => setBilling('annual')}
                className="btn btn-ghost"
                style={{ flex: 1, padding: '9px', fontSize: 11, background: billing === 'annual' ? 'var(--surface)' : 'transparent' }}
              >
                Anual · 2 meses gratis
              </button>
            </div>
          </div>

          <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 12 }}>Total {billing === 'monthly' ? 'mensual' : 'anual'}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 18 }}>{clp(price)}</span>
          </div>

          {error && <div className="form-error">{error}</div>}

          <button className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} disabled={loading}>
            {loading ? 'CONECTANDO CON STRIPE…' : 'CONTINUAR AL PAGO'}
          </button>
        </form>

        <p style={{ marginTop: 18, fontSize: 12 }} className="muted">
          Al continuar aceptas nuestros <Link href="/terms" className="accent">Términos de uso</Link> y{' '}
          <Link href="/privacy" className="accent">Política de privacidad</Link>.
        </p>
        <p style={{ marginTop: 12, fontSize: 13 }}>
          <Link href="/login" className="muted">¿Ya tienes cuenta? Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}
