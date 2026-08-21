'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { MAX_APPLICATIONS } from '@/lib/marketplace';

export type OpenRequest = {
  id: string; comuna: string; modality: string; goal: string;
  availability: string | null; created_at: string;
  slots_left: number; already_applied: boolean;
  /** el cliente pidió a ESTE coach por nombre desde el directorio */
  pedida_a_mi: boolean;
};

const MODALIDAD: Record<string, string> = {
  presencial: 'Presencial', online: 'Online', ambas: 'Presencial u online',
};

function haceCuanto(iso: string): string {
  const horas = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (horas < 1) return 'recién';
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} día${dias === 1 ? '' : 's'}`;
}

export default function RequestList({ initial }: { initial: OpenRequest[] }) {
  const [requests, setRequests] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [phones, setPhones] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function apply(id: string) {
    setError(null);
    if (!confirm(`Al postularte verás su WhatsApp y podrás escribirle. Van ${MAX_APPLICATIONS} entrenadores por solicitud. ¿Postularte?`)) return;

    setBusy(id);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc('apply_to_request', { p_request_id: id });
    setBusy(null);

    if (rpcError) {
      // "sin cupo" y "no disponible" se muestran igual a propósito: al coach no
      // le sirve saber si perdió por tiempo o por cupo, y decírselo expone
      // cuándo se publicó una solicitud que todavía no debería ver.
      setError('Esta solicitud ya no está disponible.');
      setRequests((rs) => rs.filter((r) => r.id !== id));
      return;
    }

    setPhones((p) => ({ ...p, [id]: data as string }));
    setRequests((rs) => rs.map((r) =>
      r.id === id ? { ...r, already_applied: true, slots_left: Math.max(0, r.slots_left - 1) } : r));
  }

  if (requests.length === 0) {
    return <p className="muted">No hay solicitudes disponibles por ahora.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {error && <div className="form-error">{error}</div>}

      {requests.map((r) => {
        const nueva = !r.already_applied && r.slots_left === MAX_APPLICATIONS;
        // "te pidieron a ti" es EXACTAMENTE el caso para el que existe el
        // ámbar: esto requiere que el coach haga algo, y lo generó su perfil.
        const paraMi = r.pedida_a_mi && !r.already_applied;
        return (
          <article key={r.id} style={{
            border: `1px solid ${paraMi || nueva ? 'var(--warning)' : 'var(--border)'}`,
            borderRadius: 12, padding: 16, background: 'var(--card)',
          }}>
            {paraMi && (
              <p className="label" style={{ color: 'var(--warning)', marginBottom: 8 }}>
                TE PIDIERON A TI — postula sin esperar
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span className="label">{r.comuna} · {MODALIDAD[r.modality] ?? r.modality}</span>
              <span className="muted" style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 12 }}>
                {haceCuanto(r.created_at)} · {r.slots_left} de {MAX_APPLICATIONS}
              </span>
            </div>

            <p style={{ marginTop: 8, lineHeight: 1.55 }}>{r.goal}</p>
            {r.availability && <p className="muted" style={{ fontSize: 13 }}>Disponibilidad: {r.availability}</p>}

            {phones[r.id] ? (
              <a className="btn btn-primary" style={{ marginTop: 12 }}
                 href={`https://wa.me/${phones[r.id].replace('+', '')}`}
                 target="_blank" rel="noopener noreferrer">
                ESCRIBIRLE A {phones[r.id]}
              </a>
            ) : r.already_applied ? (
              <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
                Ya te postulaste. El número está más abajo, en tus postulaciones.
              </p>
            ) : (
              <button className="btn btn-primary" style={{ marginTop: 12 }}
                      onClick={() => apply(r.id)} disabled={busy === r.id}>
                {busy === r.id ? 'POSTULANDO…' : 'POSTULARME'}
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}
