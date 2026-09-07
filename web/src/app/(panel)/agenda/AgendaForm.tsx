'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

// Agendar una sesión: alumno, fecha y hora, duración, modalidad. La política
// de con quién se puede (solo alumnos propios) la impone la base (v31).
export default function AgendaForm({ clients }: { clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [cuando, setCuando] = useState('');
  const [duracion, setDuracion] = useState(60);
  const [modalidad, setModalidad] = useState<'presencial' | 'online'>('presencial');
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function agendar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!clientId || !cuando) { setError('Elige alumno, fecha y hora.'); return; }
    const starts = new Date(cuando);
    if (starts.getTime() <= Date.now()) { setError('La sesión tiene que ser en el futuro.'); return; }
    setGuardando(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from('appointments').insert({
      coach_id: user!.id, client_id: clientId,
      starts_at: starts.toISOString(), duration_min: duracion,
      modality: modalidad, note: nota.trim() || null,
    });
    setGuardando(false);
    if (err) { setError('No se pudo agendar. Revisa los datos.'); return; }
    setCuando(''); setNota('');
    router.refresh();
  }

  if (clients.length === 0) {
    return <p className="muted">Invita a tu primer alumno para empezar a agendar.</p>;
  }

  return (
    <form onSubmit={agendar} style={{
      display: 'grid', gap: 12, border: '1px solid var(--border)',
      borderRadius: 12, padding: 16, background: 'var(--card)', maxWidth: 460,
    }}>
      <span className="label">Nueva sesión</span>

      <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      <input className="input" type="datetime-local" value={cuando}
             onChange={(e) => setCuando(e.target.value)} required />

      <div style={{ display: 'flex', gap: 8 }}>
        <select className="input" value={duracion} onChange={(e) => setDuracion(Number(e.target.value))}
                style={{ flex: 1 }}>
          {[30, 45, 60, 90].map((d) => <option key={d} value={d}>{d} min</option>)}
        </select>
        <select className="input" value={modalidad}
                onChange={(e) => setModalidad(e.target.value as 'presencial' | 'online')}
                style={{ flex: 1 }}>
          <option value="presencial">Presencial</option>
          <option value="online">Online</option>
        </select>
      </div>

      <input className="input" value={nota} onChange={(e) => setNota(e.target.value)}
             placeholder="Nota (opcional): lugar, foco de la sesión…" maxLength={200} />

      {error && <div className="form-error">{error}</div>}
      <button className="btn btn-primary" type="submit" disabled={guardando}>
        {guardando ? 'AGENDANDO…' : 'AGENDAR'}
      </button>
    </form>
  );
}
