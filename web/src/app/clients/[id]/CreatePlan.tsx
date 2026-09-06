'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

// Espejo de WeekManagerScreen en la app: el plan nace junto con su primera
// semana, listo para editar. Antes crear el plan solo se podía desde la app
// y el panel web mandaba al coach de vuelta al teléfono.
export default function CreatePlan({
  clientId, clientName, coachId,
}: { clientId: string; clientName: string; coachId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function crear() {
    setBusy(true);
    setError(null);
    const { data: plan, error: planErr } = await supabase
      .from('workout_plans')
      .insert({ client_id: clientId, name: `Plan ${clientName}`, created_by: coachId })
      .select('id')
      .single();
    if (planErr || !plan) {
      setBusy(false);
      setError(planErr?.message ?? 'No se pudo crear el plan.');
      return;
    }
    const { error: weekErr } = await supabase
      .from('plan_weeks')
      .insert({ plan_id: plan.id, week_number: 1, name: 'Semana 1', repeat_forever: true });
    setBusy(false);
    if (weekErr) { setError(weekErr.message); return; }
    router.refresh();
  }

  return (
    <div style={{ marginTop: 30 }}>
      <p className="muted" style={{ fontSize: 14 }}>
        Este cliente aún no tiene un plan.
      </p>
      <button className="btn btn-primary" onClick={crear} disabled={busy} style={{ marginTop: 12 }}>
        {busy ? 'CREANDO…' : 'CREAR SU PLAN'}
      </button>
      {error && (
        <p style={{ marginTop: 10, fontSize: 13, color: 'var(--warning)' }}>{error}</p>
      )}
    </div>
  );
}
