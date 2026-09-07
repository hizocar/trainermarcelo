'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { santiagoDayKey } from '@/lib/weeks';

// La fecha límite del plan (v36, pedido de Marcelo): hasta cuándo corre el
// plan del alumno. Vencida, la app muestra "plan finalizado" en vez de
// repetir la última semana para siempre. Vacía = sin límite.

export default function PlanEndDate({ planId, initialEndsAt }: { planId: string; initialEndsAt: string | null }) {
  const supabase = createClient();
  const [fecha, setFecha] = useState(initialEndsAt ?? '');
  const [estado, setEstado] = useState<'quieto' | 'guardando' | 'guardado'>('quieto');
  const [error, setError] = useState<string | null>(null);

  async function guardar(v: string) {
    setFecha(v);
    setEstado('guardando');
    setError(null);
    const { error: err } = await supabase
      .from('workout_plans')
      .update({ ends_at: v === '' ? null : v })
      .eq('id', planId);
    if (err) { setEstado('quieto'); setError(err.message); return; }
    setEstado('guardado');
  }

  const hoy = santiagoDayKey(new Date());
  const dias = fecha ? Math.round((Date.parse(fecha) - Date.parse(hoy)) / 86400000) : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span className="label muted" style={{ letterSpacing: 2 }}>El plan termina el</span>
      <input
        type="date"
        value={fecha}
        onChange={(e) => guardar(e.target.value)}
        style={{
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
          color: 'var(--text)', padding: '6px 10px', fontFamily: 'var(--font-mono), monospace',
          fontSize: 13, colorScheme: 'dark',
        }}
        aria-label="Fecha límite del plan"
      />
      {dias == null ? (
        <span className="muted" style={{ fontSize: 12 }}>sin límite — corre para siempre</span>
      ) : dias < 0 ? (
        <strong style={{ fontSize: 12, letterSpacing: 1, color: 'var(--warning)' }}>
          PLAN VENCIDO HACE {-dias} DÍA{dias === -1 ? '' : 'S'} — tu alumno ya no ve entrenamientos
        </strong>
      ) : (
        <span className="muted" style={{ fontSize: 12 }}>
          {dias === 0 ? 'termina hoy' : `quedan ${dias} día${dias === 1 ? '' : 's'}`}
        </span>
      )}
      {estado === 'guardado' && (
        <span className="muted" style={{ fontSize: 11, fontFamily: 'var(--font-mono), monospace' }}>GUARDADO</span>
      )}
      {error && <span style={{ fontSize: 12, color: 'var(--warning)' }}>{error}</span>}
    </div>
  );
}
