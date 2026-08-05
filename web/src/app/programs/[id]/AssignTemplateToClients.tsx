'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { firstToken } from '@/lib/env';

interface ClientOption { id: string; name: string; email: string }

// Asigna este programa (plantilla) a uno o varios clientes — el programa
// sigue existiendo tal cual para volver a usarlo después.
export default function AssignTemplateToClients({ templateId, clients }: { templateId: string; clients: ClientOption[] }) {
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
      `¿Asignar este programa a ${selected.size} cliente${selected.size === 1 ? '' : 's'}? Si ya tienen un plan, se reemplaza (su historial se conserva).`,
    )) return;

    setSaving(true);
    setError(null);
    setMsg(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError('Sesión expirada.'); setSaving(false); return; }

    try {
      const res = await fetch(`${firstToken(process.env.NEXT_PUBLIC_SUPABASE_URL)}/functions/v1/assign-template`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: firstToken(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        },
        body: JSON.stringify({ templateId, targetClientIds: Array.from(selected) }),
      });
      const result = await res.json();
      if (!res.ok || result.error) { setError(result.error ?? 'No se pudo asignar el programa.'); setSaving(false); return; }
      setMsg(`Asignado a ${result.copied} cliente${result.copied === 1 ? '' : 's'} ✓`);
      setSelected(new Set());
      setOpen(false);
    } catch (e: any) {
      setError(e.message ?? 'Error de conexión.');
    }
    setSaving(false);
  }

  if (clients.length === 0) {
    return <p className="muted" style={{ fontSize: 13 }}>Todavía no tienes clientes para asignarles este programa.</p>;
  }

  return (
    <>
      <button className="btn btn-primary" style={{ padding: '10px 18px' }} onClick={() => setOpen(true)}>
        ASIGNAR A CLIENTES
      </button>
      {msg && <p style={{ color: 'var(--success)', fontSize: 13, marginTop: 8 }}>{msg}</p>}

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 4 }}>Asignar este programa a clientes</h3>
            <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
              Se copian todos los días, ejercicios y series como un plan independiente para
              cada cliente elegido. Si un cliente ya tiene un plan, se reemplaza (su historial
              de entrenamientos registrados no se toca). El programa sigue disponible acá para
              volver a usarlo.
            </p>
            <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {clients.map((c) => (
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
                {saving ? 'ASIGNANDO…' : `ASIGNAR A ${selected.size || ''}`.trim()}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
