'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

export default function EditableName({ templateId, initialName }: { templateId: string; initialName: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function commit() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === initialName) { setName(initialName || trimmed); return; }
    setSaving(true);
    const { error } = await supabase.from('program_templates').update({ name: trimmed }).eq('id', templateId);
    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      router.refresh();
    }
  }

  return (
    <div>
      <input
        className="display"
        style={{
          fontSize: 40,
          background: 'transparent',
          border: 'none',
          borderBottom: '2px dashed var(--border)',
          outline: 'none',
          width: '100%',
          padding: '0 0 4px',
        }}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        disabled={saving}
        placeholder="Nombre del programa"
      />
      <span className="label muted" style={{ fontSize: 10, letterSpacing: 1 }}>
        ✎ {saving ? 'guardando…' : saved ? 'guardado' : 'toca para editar el nombre'}
      </span>
    </div>
  );
}
