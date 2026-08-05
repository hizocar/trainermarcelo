'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

export default function DeleteProgramButton({ templateId, name }: { templateId: string; name: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function del(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`¿Borrar el programa "${name}"? Esto no afecta a los clientes a los que ya se les asignó.`)) return;
    setSaving(true);
    await supabase.from('program_templates').delete().eq('id', templateId);
    router.refresh();
  }

  return (
    <button className="icon-btn" title="Borrar programa" onClick={del} disabled={saving}>✕</button>
  );
}
