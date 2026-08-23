'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

export default function CancelarCita({ citaId }: { citaId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function cancelar() {
    if (busy || !confirm('¿Cancelar esta sesión? Tu alumno la dejará de ver como agendada.')) return;
    setBusy(true);
    const supabase = createClient();
    await supabase.from('appointments')
      .update({ status: 'cancelada_coach' })
      .eq('id', citaId);
    router.refresh();
  }

  return (
    <button className="btn btn-ghost" onClick={cancelar} disabled={busy}
            style={{ padding: '6px 12px', fontSize: 11 }}>
      CANCELAR
    </button>
  );
}
