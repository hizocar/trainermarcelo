'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { santiagoDayKey } from '@/lib/weeks';

// La ficha del cliente (camino Traineeks): notas privadas del coach y fecha
// de próxima revisión del plan. Las notas se guardan solas al dejar de
// escribir; el alumno nunca las ve (RLS v33 — solo el coach del cliente).

export default function ClientFile({
  clientId, coachId, initialNotes, initialReview,
}: { clientId: string; coachId: string; initialNotes: string; initialReview: string | null }) {
  const supabase = createClient();
  const [notes, setNotes] = useState(initialNotes);
  const [review, setReview] = useState(initialReview ?? '');
  const [estado, setEstado] = useState<'quieto' | 'guardando' | 'guardado' | 'error'>('quieto');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function guardar(nuevasNotas: string, nuevaRevision: string) {
    setEstado('guardando');
    const { error } = await supabase.from('client_files').upsert({
      client_id: clientId,
      coach_id: coachId,
      notes: nuevasNotas,
      next_review_at: nuevaRevision === '' ? null : nuevaRevision,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'client_id' });
    if (error) {
      setEstado('error');
      setErrorMsg(error.message);
      return;
    }
    setEstado('guardado');
    setErrorMsg(null);
  }

  function onNotes(v: string) {
    setNotes(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => guardar(v, review), 800);
  }

  function onReview(v: string) {
    setReview(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    guardar(notes, v);
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // "Revisión en N días" — días calendario en hora de Chile, no UTC
  const hoy = santiagoDayKey(new Date());
  const dias = review
    ? Math.round((Date.parse(review) - Date.parse(hoy)) / 86400000)
    : null;

  return (
    <div className="editor-day" style={{ marginTop: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span className="label muted" style={{ letterSpacing: 2 }}>Ficha del coach</span>
        <span className="muted" style={{ fontSize: 11, marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>
          {estado === 'guardando' ? 'GUARDANDO…' : estado === 'guardado' ? 'GUARDADO' : ''}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
        <label className="muted" htmlFor="prox-revision" style={{ fontSize: 13 }}>Próxima revisión del plan</label>
        <input
          id="prox-revision"
          type="date"
          value={review}
          onChange={(e) => onReview(e.target.value)}
          style={{
            background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
            color: 'var(--text)', padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: 13,
            colorScheme: 'dark',
          }}
        />
        {dias != null && (
          <strong style={{
            fontSize: 12, letterSpacing: 1,
            color: dias < 0 ? 'var(--warning)' : dias <= 3 ? 'var(--warning)' : 'var(--text-secondary)',
          }}>
            {dias < 0
              ? `REVISIÓN VENCIDA HACE ${-dias} DÍA${dias === -1 ? '' : 'S'}`
              : dias === 0
                ? 'REVISIÓN HOY'
                : `Revisión en ${dias} día${dias === 1 ? '' : 's'}`}
          </strong>
        )}
      </div>

      <textarea
        value={notes}
        onChange={(e) => onNotes(e.target.value)}
        placeholder="Apunta aquí lo que quieras de este alumno — lesiones, objetivos, acuerdos. Solo tú lo ves."
        rows={3}
        style={{
          width: '100%', marginTop: 12, resize: 'vertical',
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
          color: 'var(--text)', padding: '10px 12px', fontSize: 13, lineHeight: 1.5,
          fontFamily: 'inherit', boxSizing: 'border-box',
        }}
      />
      {errorMsg && (
        <p style={{ fontSize: 12, color: 'var(--warning)', marginTop: 6 }}>
          No se pudo guardar: {errorMsg}
        </p>
      )}
    </div>
  );
}
