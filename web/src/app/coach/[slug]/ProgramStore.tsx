'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { clp } from '@/lib/plans';

// La vitrina de rutinas del coach (store fase 1, sin pasarela): el interesado
// deja su solicitud y el coach cierra el pago directo. Las portadas son las
// tipográficas del catálogo — misma casa, cero fotos de stock.

export interface ProgramaVitrina {
  id: string;
  name: string;
  level: string | null;
  focus: string | null;
  description: string | null;
  price_clp: number;
  duration_weeks: number | null;
  days: number;
}

export default function ProgramStore({ programas, coachName }: { programas: ProgramaVitrina[]; coachName: string }) {
  const supabase = createClient();
  const [abierto, setAbierto] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviadas, setEnviadas] = useState<Set<string>>(new Set());

  async function solicitar(programaId: string) {
    setError(null);
    if (nombre.trim() === '' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError('Tu nombre y un correo válido son obligatorios.');
      return;
    }
    setEnviando(true);
    const { error: err } = await supabase.rpc('solicitar_programa', {
      p_template: programaId,
      p_name: nombre.trim(),
      p_email: email.trim(),
      p_message: mensaje.trim() === '' ? null : mensaje.trim(),
    });
    setEnviando(false);
    if (err) { setError(err.message); return; }
    setEnviadas(prev => new Set(prev).add(programaId));
    setAbierto(null);
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
    color: 'var(--text)', padding: '10px 12px', fontSize: 14, width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <section style={{ marginTop: 32 }}>
      <h2 className="label" style={{ letterSpacing: 2 }}>SUS RUTINAS</h2>
      <div style={{ display: 'grid', gap: 14, marginTop: 12 }}>
        {programas.map((p) => (
          <article key={p.id} style={{
            border: '1px solid var(--border)', borderRadius: 12,
            background: 'var(--card)', overflow: 'hidden',
          }}>
            <div style={{
              position: 'relative', padding: '18px 16px 14px',
              background: 'linear-gradient(135deg, var(--card) 0%, var(--bg) 100%)',
              borderBottom: '1px solid var(--border)',
            }}>
              <span aria-hidden style={{
                position: 'absolute', right: -6, top: -22,
                fontFamily: 'var(--font-display), sans-serif', fontSize: 110, lineHeight: 1,
                color: 'transparent', WebkitTextStroke: '1px var(--border)',
                userSelect: 'none', textTransform: 'uppercase', pointerEvents: 'none',
              }}>{p.name.trim().charAt(0)}</span>
              <h3 className="display" style={{ fontSize: 22, margin: 0, textTransform: 'uppercase', position: 'relative' }}>
                {p.name}
              </h3>
              <p className="label muted" style={{ marginTop: 6, fontSize: 11, letterSpacing: 1 }}>
                {[
                  p.level ? p.level.toUpperCase() : null,
                  p.focus ? p.focus.toUpperCase() : null,
                  `${p.days} DÍA${p.days === 1 ? '' : 'S'}/SEM`,
                  p.duration_weeks != null ? `${p.duration_weeks} SEMANAS` : 'SIN LÍMITE',
                ].filter(Boolean).join(' · ')}
              </p>
            </div>

            <div style={{ padding: '14px 16px' }}>
              {p.description && (
                <p style={{ fontSize: 14, lineHeight: 1.6, margin: '0 0 12px' }}>{p.description}</p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <strong className="display" style={{ fontSize: 22 }}>{clp(p.price_clp)}</strong>
                {enviadas.has(p.id) ? (
                  <span className="accent" style={{ fontSize: 13, fontWeight: 700 }}>
                    SOLICITUD ENVIADA — {coachName.split(' ')[0]} te va a escribir
                  </span>
                ) : (
                  <button
                    className="btn btn-primary"
                    style={{ padding: '10px 22px' }}
                    onClick={() => { setAbierto(abierto === p.id ? null : p.id); setError(null); }}
                  >
                    LO QUIERO
                  </button>
                )}
              </div>

              {abierto === p.id && (
                <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                  <input style={inputStyle} placeholder="Tu nombre" value={nombre}
                    onChange={(e) => setNombre(e.target.value)} aria-label="Tu nombre" />
                  <input style={inputStyle} placeholder="Tu correo" type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)} aria-label="Tu correo" />
                  <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2}
                    placeholder="Mensaje (opcional)" value={mensaje}
                    onChange={(e) => setMensaje(e.target.value)} aria-label="Mensaje" />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button className="btn btn-primary" disabled={enviando} onClick={() => solicitar(p.id)}>
                      {enviando ? 'ENVIANDO…' : 'ENVIAR SOLICITUD'}
                    </button>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {coachName.split(' ')[0]} te contacta para coordinar el pago.
                    </span>
                  </div>
                  {error && <p style={{ fontSize: 13, color: 'var(--warning)', margin: 0 }}>{error}</p>}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
