'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

export type MyApplication = {
  // null cuando la solicitud ya no está abierta: page.tsx la vacía antes de
  // enviar el payload al cliente, no la escondemos solo en el render.
  request_id: string; name: string; whatsapp: string | null; comuna: string;
  modality: string; goal: string; availability: string | null;
  applied_at: string; status: string;
};

export default function MyApplications({ initial }: { initial: MyApplication[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function claim(id: string, name: string) {
    if (!confirm(`¿${name} es tu alumno? Se cierra la solicitud y se te abre el panel.`)) return;
    setBusy(id); setError(null);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc('claim_request', { p_request_id: id });
    setBusy(null);

    if (rpcError) { setError('No se pudo cerrar la solicitud. Recarga e inténtalo de nuevo.'); return; }

    // El panel recién bloqueado se abre en el servidor: hay que revalidar, no
    // basta con cambiar el estado local.
    router.refresh();
  }

  if (initial.length === 0) return null;

  return (
    <section style={{ marginTop: 40 }}>
      <h2 className="display" style={{ fontSize: 20 }}>MIS POSTULACIONES</h2>
      {error && <div className="form-error">{error}</div>}

      <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        {initial.map((a) => (
          <article key={a.request_id} style={{
            border: '1px solid var(--border)', borderRadius: 12,
            padding: 16, background: 'var(--card)',
            opacity: a.status === 'open' ? 1 : 0.55,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <strong>{a.name}</strong>
              <span className="muted" style={{ fontSize: 12 }}>{a.comuna}</span>
            </div>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{a.goal}</p>

            {a.status === 'open' ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {a.whatsapp && (
                  <a className="btn btn-ghost"
                     href={`https://wa.me/${a.whatsapp.replace('+', '')}`}
                     target="_blank" rel="noopener noreferrer">WHATSAPP</a>
                )}
                <button className="btn btn-primary" disabled={busy === a.request_id}
                        onClick={() => claim(a.request_id, a.name)}>
                  {busy === a.request_id ? 'CERRANDO…' : 'LO TOMÉ'}
                </button>
              </div>
            ) : (
              <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
                Solicitud cerrada.
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
