'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

// Regalar meses del panel a un coach: correo + días. La base impone las
// reglas (solo admin, 1-365 días, jamás encima de quien paga por Flow) y
// devuelve la frase de confirmación con la fecha de término.
export default function RegalarPanel() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [dias, setDias] = useState(30);
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function regalar(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setResultado(null); setBusy(true);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc('regalar_panel', {
      p_coach_email: email.trim(), p_dias: dias,
    });
    setBusy(false);
    if (rpcError) {
      setError(
        rpcError.message.includes('ya paga') ? 'Ese gimnasio ya paga por Flow — no necesita regalo.'
        : rpcError.message.includes('no hay un coach') ? 'No hay un coach con ese correo.'
        : 'No se pudo regalar. Revisa el correo.',
      );
      return;
    }
    setResultado(String(data));
    setEmail('');
    router.refresh();
  }

  return (
    <form onSubmit={regalar} style={{
      display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
      border: '1px solid var(--border)', borderRadius: 12,
      padding: '14px 16px', background: 'var(--card)',
    }}>
      <span className="label">Regalar panel</span>
      <input className="input" type="email" value={email} required
             onChange={(e) => setEmail(e.target.value)}
             placeholder="correo del coach" style={{ flex: '1 1 220px' }} />
      <select className="input" value={dias} onChange={(e) => setDias(Number(e.target.value))}
              style={{ width: 130 }}>
        <option value={30}>1 mes</option>
        <option value={60}>2 meses</option>
        <option value={90}>3 meses</option>
        <option value={180}>6 meses</option>
      </select>
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? 'REGALANDO…' : 'REGALAR'}
      </button>
      {error && <p className="form-error" style={{ width: '100%' }}>{error}</p>}
      {resultado && <p className="muted" style={{ width: '100%', fontSize: 13 }}>✓ {resultado}</p>}
    </form>
  );
}
