'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

// Solicitudes de compra del store (fase 1): cada fila es alguien que quiere
// una rutina. El coach le escribe, cobra directo, y la entrega es con las
// piezas que ya existen: crear el cliente e "Asignar a clientes" desde el
// programa. "Atendida" solo la saca de la bandeja.

export interface Solicitud {
  id: string;
  name: string;
  email: string;
  message: string | null;
  created_at: string;
  programa: string;
}

export default function RequestsInbox({ solicitudes }: { solicitudes: Solicitud[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function atender(id: string) {
    setBusy(id);
    setError(null);
    const { error: err } = await supabase
      .from('program_requests')
      .update({ status: 'atendida' })
      .eq('id', id);
    setBusy(null);
    if (err) { setError(err.message); return; }
    router.refresh();
  }

  if (solicitudes.length === 0) return null;

  return (
    <div className="editor-day" style={{ marginTop: 24, borderColor: 'var(--warning)' }}>
      <span className="label" style={{ letterSpacing: 2, color: 'var(--warning)' }}>
        SOLICITUDES DE COMPRA · {solicitudes.length}
      </span>
      {solicitudes.map((s) => (
        <div key={s.id} style={{
          borderTop: '1px solid var(--border)', padding: '12px 0',
          display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <strong style={{ fontSize: 14 }}>{s.name}</strong>
            <span className="muted" style={{ fontSize: 13 }}> quiere </span>
            <strong style={{ fontSize: 14 }}>{s.programa}</strong>
            <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
              <a href={`mailto:${s.email}`} style={{ color: 'inherit' }}>{s.email}</a>
              {s.message ? ` — "${s.message}"` : ''}
            </div>
          </div>
          <button
            className="btn btn-ghost"
            style={{ padding: '8px 14px' }}
            onClick={() => atender(s.id)}
            disabled={busy === s.id}
          >
            {busy === s.id ? '…' : 'ATENDIDA'}
          </button>
        </div>
      ))}
      <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
        Escríbele, cobra directo, y para entregar: crea al comprador como cliente y usa
        &quot;Asignar a clientes&quot; dentro del programa.
      </p>
      {error && <p style={{ fontSize: 13, color: 'var(--warning)' }}>{error}</p>}
    </div>
  );
}
