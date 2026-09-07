'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

export default function NewProgramButton() {
  const supabase = createClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) { setError('Ponle un nombre al programa.'); return; }
    setSaving(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Sesión expirada.'); setSaving(false); return; }

    const { data, error: insErr } = await supabase
      .from('program_templates')
      .insert({ coach_id: user.id, name: trimmed })
      .select('id')
      .single();

    if (insErr || !data) { setError(insErr?.message ?? 'No se pudo crear el programa.'); setSaving(false); return; }
    router.push(`/programs/${data.id}`);
  }

  if (!open) {
    return (
      <button className="btn btn-primary" style={{ padding: '10px 18px' }} onClick={() => setOpen(true)}>
        + CREAR PROGRAMA
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 240 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          autoFocus
          placeholder="ej: Full body / 3 días"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') create(); if (e.key === 'Escape') setOpen(false); }}
          disabled={saving}
        />
        <button className="btn btn-primary" style={{ padding: '10px 18px' }} onClick={create} disabled={saving}>
          {saving ? 'CREANDO…' : 'CREAR'}
        </button>
      </div>
      {error && <div className="form-error">{error}</div>}
    </div>
  );
}
