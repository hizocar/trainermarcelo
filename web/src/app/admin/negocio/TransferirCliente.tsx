'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

// Cambiar a un alumno de coach (v38): correo del alumno + correo del coach
// nuevo. El historial completo (logs, sesiones, ánimo, PAR-Q, plan) viaja
// con el alumno; el coach nuevo puede editar el plan desde el primer
// segundo y el anterior pierde el acceso. La libreta privada del coach
// anterior NO se hereda y sus citas futuras se cancelan — todo lo impone
// la función en la base; acá solo se recogen los correos.
export default function TransferirCliente() {
  const [clienteEmail, setClienteEmail] = useState('');
  const [coachEmail, setCoachEmail] = useState('');
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function transferir(e: React.FormEvent) {
    e.preventDefault();
    if (!window.confirm(
      `¿Pasar a ${clienteEmail.trim()} al coach ${coachEmail.trim()}?\n\n` +
      'El coach anterior pierde el acceso, sus citas futuras se cancelan y su ficha privada se borra. ' +
      'El historial y el plan del alumno quedan intactos para el coach nuevo.',
    )) return;
    setError(null); setResultado(null); setBusy(true);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc('transferir_cliente', {
      p_client_email: clienteEmail.trim(), p_new_coach_email: coachEmail.trim(),
    });
    setBusy(false);
    if (rpcError) {
      setError(
        rpcError.message.includes('no hay un cliente') ? 'No hay un cliente con ese correo.'
        : rpcError.message.includes('no hay un coach') ? 'No hay un coach con ese correo.'
        : rpcError.message.includes('ya es su coach') ? 'Ese ya es su coach.'
        : 'No se pudo transferir. Revisa los correos.',
      );
      return;
    }
    setResultado(String(data));
    setClienteEmail('');
    setCoachEmail('');
  }

  return (
    <form onSubmit={transferir} style={{
      display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
      border: '1px solid var(--border)', borderRadius: 12,
      padding: '14px 16px', background: 'var(--card)', marginTop: 14,
    }}>
      <span className="label">Cambiar de coach</span>
      <input
        className="input"
        style={{ flex: 1, minWidth: 210 }}
        type="email"
        placeholder="correo del alumno"
        value={clienteEmail}
        onChange={(e) => setClienteEmail(e.target.value)}
        required
      />
      <span className="muted" style={{ fontSize: 13 }}>→</span>
      <input
        className="input"
        style={{ flex: 1, minWidth: 210 }}
        type="email"
        placeholder="correo del coach nuevo"
        value={coachEmail}
        onChange={(e) => setCoachEmail(e.target.value)}
        required
      />
      <button className="btn btn-primary" style={{ padding: '11px 18px' }} disabled={busy}>
        {busy ? 'TRANSFIRIENDO…' : 'TRANSFERIR'}
      </button>
      {resultado && <p style={{ width: '100%', fontSize: 13, color: 'var(--accent)' }}>{resultado}</p>}
      {error && <p style={{ width: '100%', fontSize: 13, color: 'var(--warning)' }}>{error}</p>}
    </form>
  );
}
