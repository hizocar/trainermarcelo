'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { firstToken } from '@/lib/env';

interface ClientOption { id: string; name: string; email: string }

// Copia el plan de este cliente a otros — cada copia queda independiente
// desde el momento en que se crea (no es una plantilla enlazada).
export default function AssignToClients({ sourceClientId, otherClients }: { sourceClientId: string; otherClients: ClientOption[] }) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function confirm() {
    if (selected.size === 0) return;
    if (!window.confirm(
      `¿Copiar este plan a ${selected.size} cliente${selected.size === 1 ? '' : 's'}? Si ya tienen un plan, se reemplaza (su historial se conserva).`,
    )) return;

    setSaving(true);
    setError(null);
    setMsg(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError('Sesión expirada.'); setSaving(false); return; }

    try {
      const res = await fetch(`${firstToken(process.env.NEXT_PUBLIC_SUPABASE_URL)}/functions/v1/duplicate-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: firstToken(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        },
        body: JSON.stringify({ sourceClientId, targetClientIds: Array.from(selected) }),
      });
      const result = await res.json();
      if (!res.ok || result.error) { setError(result.error ?? 'No se pudo copiar el plan.'); setSaving(false); return; }
      setMsg(`Plan copiado a ${result.copied} cliente${result.copied === 1 ? '' : 's'} ✓`);
      setSelected(new Set());
      setOpen(false);
    } catch (e: any) {
      setError(e.message ?? 'Error de conexión.');
    }
    setSaving(false);
  }

  if (otherClients.length === 0) return null;

  return (
    <>
      <button className="btn btn-ghost" style={{ padding: '10px 18px' }} onClick={() => setOpen(true)}>
        ASIGNAR A OTROS CLIENTES
      </button>
      {msg && <p style={{ color: 'var(--success)', fontSize: 13, marginTop: 8 }}>{msg}</p>}

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 4 }}>Asignar este plan a otros clientes</h3>
            <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
              Se copian todos los días, ejercicios y series como un plan independiente para
              cada cliente elegido — si después le ajustas algo a uno, no afecta a los demás.
              Si un cliente ya tiene un plan, se reemplaza (su historial de entrenamientos
              registrados no se toca).
            </p>
            <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {otherClients.map((c) => (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                  <span>{c.name}</span>
                  <small className="muted" style={{ marginLeft: 'auto' }}>{c.email}</small>
                </label>
              ))}
            </div>
            {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" style={{ padding: '10px 16px' }} onClick={() => setOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ padding: '10px 16px' }} onClick={confirm} disabled={saving || selected.size === 0}>
                {saving ? 'COPIANDO…' : `COPIAR A ${selected.size || ''}`.trim()}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
