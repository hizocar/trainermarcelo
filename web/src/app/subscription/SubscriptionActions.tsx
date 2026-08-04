'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

export default function SubscriptionActions({ hasStripe }: { hasStripe: boolean }) {
  const supabase = createClient();
  const [loading, setLoading] = useState<'portal' | 'cancel' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(action: 'portal' | 'cancel') {
    setLoading(action);
    setError(null);
    setMessage(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError('Sesión expirada.'); setLoading(null); return; }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
        },
        body: JSON.stringify({ action }),
      });
      const result = await res.json();
      if (!res.ok || result.error) { setError(result.error ?? 'No se pudo completar la acción.'); setLoading(null); return; }
      if (result.url) { window.location.href = result.url; return; }
      setMessage(result.message ?? 'Listo.');
    } catch (e: any) {
      setError(e.message ?? 'Error de conexión.');
    }
    setLoading(null);
  }

  if (!hasStripe) {
    return <p className="muted" style={{ fontSize: 13 }}>Esta cuenta no tiene facturación de Stripe asociada.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button className="btn btn-primary" onClick={() => call('portal')} disabled={loading !== null}>
        {loading === 'portal' ? 'ABRIENDO…' : 'PORTAL DE FACTURACIÓN'}
      </button>
      <button
        className="btn btn-ghost"
        style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
        onClick={() => { if (window.confirm('¿Cancelar tu suscripción al final del período actual?')) call('cancel'); }}
        disabled={loading !== null}
      >
        {loading === 'cancel' ? 'CANCELANDO…' : 'CANCELAR SUSCRIPCIÓN'}
      </button>
      {message && <p style={{ color: 'var(--success)', fontSize: 13 }}>{message}</p>}
      {error && <div className="form-error">{error}</div>}
    </div>
  );
}
