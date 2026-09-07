'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { clp } from '@/lib/plans';

// Poner el programa a la venta en el perfil público del coach (store fase 1).
// El precio va en CLP y la descripción es lo que ve el comprador en la
// vitrina. Requiere perfil aprobado en el marketplace — si no, la vitrina
// simplemente no lo muestra (la vista pública filtra por coach aprobado).

export default function SellProgram({
  templateId, initialForSale, initialPrice, initialDescription,
}: { templateId: string; initialForSale: boolean; initialPrice: number | null; initialDescription: string | null }) {
  const supabase = createClient();
  const router = useRouter();
  const [forSale, setForSale] = useState(initialForSale);
  const [precio, setPrecio] = useState(initialPrice != null ? String(initialPrice) : '');
  const [descripcion, setDescripcion] = useState(initialDescription ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(venta: boolean) {
    setError(null);
    const p = parseInt(precio, 10);
    if (venta && (!Number.isFinite(p) || p < 1000 || p > 1000000)) {
      setError('Para vender, pon un precio entre $1.000 y $1.000.000.');
      return;
    }
    setBusy(true);
    const { error: err } = await supabase
      .from('program_templates')
      .update({
        for_sale: venta,
        price_clp: Number.isFinite(p) ? p : null,
        description: descripcion.trim() === '' ? null : descripcion.trim().slice(0, 1000),
      })
      .eq('id', templateId);
    setBusy(false);
    if (err) { setError(err.message); return; }
    setForSale(venta);
    router.refresh();
  }

  return (
    <div className="editor-day" style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span className="label muted" style={{ letterSpacing: 2 }}>VENDER ESTA RUTINA</span>
        {forSale && (
          <strong className="accent" style={{ fontSize: 12, letterSpacing: 1 }}>
            EN VENTA · {precio !== '' && Number.isFinite(parseInt(precio, 10)) ? clp(parseInt(precio, 10)) : ''}
          </strong>
        )}
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
        Aparece en tu perfil público del marketplace. El interesado deja su solicitud y tú
        coordinas el pago directo — sin comisión en esta etapa.
      </p>

      <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <input
          className="input"
          style={{ width: 130 }}
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          placeholder="Precio CLP"
          inputMode="numeric"
          aria-label="Precio en pesos chilenos"
        />
        <textarea
          className="input"
          style={{ flex: 1, minWidth: 220, resize: 'vertical', boxSizing: 'border-box' }}
          rows={2}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Qué incluye, para quién es — esto ve el comprador"
          maxLength={1000}
          aria-label="Descripción para la vitrina"
        />
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {forSale ? (
          <>
            <button className="btn btn-ghost" onClick={() => guardar(false)} disabled={busy}>
              {busy ? '…' : 'QUITAR DE LA VENTA'}
            </button>
            <button className="btn btn-primary" onClick={() => guardar(true)} disabled={busy}>
              {busy ? '…' : 'GUARDAR CAMBIOS'}
            </button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={() => guardar(true)} disabled={busy}>
            {busy ? '…' : 'PONER A LA VENTA'}
          </button>
        )}
        {error && <span style={{ fontSize: 13, color: 'var(--warning)' }}>{error}</span>}
      </div>
    </div>
  );
}
