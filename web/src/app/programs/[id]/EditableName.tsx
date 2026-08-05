'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

export default function EditableName({ templateId, initialName }: { templateId: string; initialName: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);

  async function commit() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === initialName) { setName(initialName || trimmed); return; }
    setSaving(true);
    const { error } = await supabase.from('program_templates').update({ name: trimmed }).eq('id', templateId);
    setSaving(false);
    if (!error) router.refresh();
  }

  return (
    <input
      className="display"
      style={{ fontSize: 40, background: 'transparent', border: 'none', outline: 'none', width: '100%', padding: 0 }}
      value={name}
      onChange={(e) => setName(e.target.value)}
      onBlur={commit}
      disabled={saving}
      placeholder="Nombre del programa"
    />
  );
}
