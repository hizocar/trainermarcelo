'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

export default function EditableDuration({
  templateId, initialWeeks,
}: { templateId: string; initialWeeks: number | null }) {
  const supabase = createClient();
  const router = useRouter();
  const [value, setValue] = useState(initialWeeks != null ? String(initialWeeks) : '');
  const [saving, setSaving] = useState(false);

  async function commit() {
    const trimmed = value.trim();
    const parsed = trimmed === '' ? null : parseInt(trimmed, 10);
    if (parsed != null && (isNaN(parsed) || parsed < 1 || parsed > 52)) {
      setValue(initialWeeks != null ? String(initialWeeks) : '');
      return;
    }
    if (parsed === (initialWeeks ?? null)) return;
    setSaving(true);
    await supabase.from('program_templates').update({ duration_weeks: parsed }).eq('id', templateId);
    setSaving(false);
    router.refresh();
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span className="label muted" style={{ fontSize: 10, letterSpacing: 1 }}>DURACIÓN</span>
      <input
        className="input"
        style={{ width: 70, textAlign: 'center' }}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        disabled={saving}
        placeholder="∞"
        inputMode="numeric"
      />
      <span className="muted" style={{ fontSize: 12 }}>
        {value.trim() ? 'semanas' : 'semanas (vacío = indefinido, se repite siempre)'}
      </span>
    </div>
  );
}
