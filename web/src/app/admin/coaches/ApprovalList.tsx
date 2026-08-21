'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { slugify } from '@/lib/marketplace';

export type PendingCoach = {
  id: string; name: string; email: string;
  instagram: string | null; created_at: string;
};

export default function ApprovalList({ initial }: { initial: PendingCoach[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(coach: PendingCoach, approve: boolean) {
    setBusy(coach.id); setError(null);
    const supabase = createClient();
    const { error: rpcError } = approve
      ? await supabase.rpc('approve_coach', { p_coach_id: coach.id, p_slug: slugify(coach.name) })
      : await supabase.rpc('reject_coach', { p_coach_id: coach.id });
    setBusy(null);
    if (rpcError) { setError(rpcError.message); return; }
    router.refresh();
  }

  if (initial.length === 0) return <p className="muted">No hay coaches esperando.</p>;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {error && <div className="form-error">{error}</div>}

      {initial.map((c) => (
        <article key={c.id} style={{
          border: '1px solid var(--border)', borderRadius: 12,
          padding: 16, background: 'var(--card)',
        }}>
          <strong>{c.name}</strong>
          <p className="muted" style={{ fontSize: 13 }}>{c.email}</p>
          {c.instagram && (
            <p className="muted" style={{ fontSize: 13 }}>
              <a href={`https://instagram.com/${c.instagram}`} target="_blank" rel="noopener noreferrer">
                @{c.instagram}
              </a>
            </p>
          )}
          <p className="muted" style={{ fontSize: 12 }}>
            Su página quedaría en /coach/{slugify(c.name)}
          </p>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" disabled={busy === c.id}
                    onClick={() => decide(c, true)}>APROBAR</button>
            <button className="btn btn-ghost" disabled={busy === c.id}
                    onClick={() => decide(c, false)}>RECHAZAR</button>
          </div>
        </article>
      ))}
    </div>
  );
}
