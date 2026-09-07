'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

// Nivel y enfoque del programa (v34): con esto la tarjeta del catálogo se
// etiqueta y filtra sola. Mismo patrón de guardado que EditableDuration.

const NIVELES = ['principiante', 'intermedio', 'avanzado'];

export default function EditableTags({
  templateId, initialLevel, initialFocus,
}: { templateId: string; initialLevel: string | null; initialFocus: string | null }) {
  const supabase = createClient();
  const router = useRouter();
  const [level, setLevel] = useState(initialLevel ?? '');
  const [focus, setFocus] = useState(initialFocus ?? '');
  const [error, setError] = useState<string | null>(null);

  async function guardar(campos: { level?: string | null; focus?: string | null }) {
    setError(null);
    const { error: err } = await supabase.from('program_templates').update(campos).eq('id', templateId);
    if (err) { setError(err.message); return; }
    router.refresh();
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span className="label muted" style={{ fontSize: 10, letterSpacing: 1 }}>NIVEL</span>
      <select
        value={level}
        onChange={(e) => { setLevel(e.target.value); guardar({ level: e.target.value === '' ? null : e.target.value }); }}
        style={{
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8,
          color: 'var(--text)', padding: '8px 10px', fontSize: 13,
        }}
        aria-label="Nivel del programa"
      >
        <option value="">Sin nivel</option>
        {NIVELES.map(n => <option key={n} value={n}>{n[0].toUpperCase() + n.slice(1)}</option>)}
      </select>

      <span className="label muted" style={{ fontSize: 10, letterSpacing: 1, marginLeft: 8 }}>ENFOQUE</span>
      <input
        className="input"
        style={{ width: 150 }}
        value={focus}
        onChange={(e) => setFocus(e.target.value)}
        onBlur={() => guardar({ focus: focus.trim() === '' ? null : focus.trim().slice(0, 40) })}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        placeholder="Full body, fuerza…"
        maxLength={40}
        aria-label="Enfoque del programa"
      />
      {error && <span style={{ fontSize: 12, color: 'var(--warning)' }}>{error}</span>}
    </div>
  );
}
