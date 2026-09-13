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
    if (!window.confirm(`¿Quitar el programa "${name}" de tu catálogo? No afecta a los clientes que ya lo tienen, y si te arrepientes se puede recuperar.`)) return;
    setSaving(true);
    // archivar, no borrar: un programa lleva horas de trabajo (v40)
    const { error } = await supabase.from('program_templates').update({ archived: true }).eq('id', templateId);
    if (error) { window.alert(`No se pudo quitar: ${error.message}`); setSaving(false); return; }
    router.refresh();
  }

  return (
    <button className="icon-btn" title="Quitar del catálogo (recuperable)" onClick={del} disabled={saving}>✕</button>
  );
}
