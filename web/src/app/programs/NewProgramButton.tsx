'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

export default function NewProgramButton() {
  const supabase = createClient();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setSaving(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Sesión expirada.'); setSaving(false); return; }

    const { data, error: insErr } = await supabase
      .from('program_templates')
      .insert({ coach_id: user.id, name: 'Nuevo programa' })
      .select('id')
      .single();

    if (insErr || !data) { setError(insErr?.message ?? 'No se pudo crear el programa.'); setSaving(false); return; }
    router.push(`/programs/${data.id}`);
  }

  return (
    <div>
      <button className="btn btn-primary" style={{ padding: '10px 18px' }} onClick={create} disabled={saving}>
        {saving ? 'CREANDO…' : '+ CREAR PROGRAMA'}
      </button>
      {error && <div className="form-error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}
