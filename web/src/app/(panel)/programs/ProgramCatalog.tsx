'use client';

import { useState } from 'react';
import Link from 'next/link';
import DeleteProgramButton from './DeleteProgramButton';

// El catálogo de programas (camino Traineeks, con nuestra piel): portadas
// tipográficas autogeneradas — el nombre en Anton sobre el monocromo, con la
// inicial gigante de fondo — en vez de fotos de stock. El coach no diseña
// nada y todas las tarjetas se ven de la misma casa.

export interface ProgramaCard {
  id: string;
  name: string;
  days: number;
  weeks: number | null;
  level: string | null;
  focus: string | null;
}

const NIVELES = ['principiante', 'intermedio', 'avanzado'];

export default function ProgramCatalog({ programas }: { programas: ProgramaCard[] }) {
  const [q, setQ] = useState('');
  const [nivel, setNivel] = useState('');
  const [enfoque, setEnfoque] = useState('');

  const enfoques = Array.from(new Set(programas.map(p => p.focus).filter((f): f is string => !!f))).sort();

  const visibles = programas.filter(p =>
    (q.trim() === '' || p.name.toLowerCase().includes(q.trim().toLowerCase()))
    && (nivel === '' || p.level === nivel)
    && (enfoque === '' || p.focus === enfoque),
  );

  const selectStyle: React.CSSProperties = {
    background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8,
    color: 'var(--text)', padding: '10px 12px', fontSize: 13,
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 200 }}
          placeholder="Buscar programa"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar programa"
        />
        <select value={nivel} onChange={(e) => setNivel(e.target.value)} style={selectStyle} aria-label="Nivel">
          <option value="">Todos los niveles</option>
          {NIVELES.map(n => <option key={n} value={n}>{n[0].toUpperCase() + n.slice(1)}</option>)}
        </select>
        {enfoques.length > 0 && (
          <select value={enfoque} onChange={(e) => setEnfoque(e.target.value)} style={selectStyle} aria-label="Enfoque">
            <option value="">Todos los enfoques</option>
            {enfoques.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        )}
      </div>

      {visibles.length === 0 ? (
        <p className="muted" style={{ marginTop: 32 }}>
          {programas.length === 0
            ? 'Todavía no tienes programas creados. Empieza con "+ Crear programa".'
            : 'Ningún programa calza con ese filtro.'}
        </p>
      ) : (
        <div style={{
          display: 'grid', gap: 16, marginTop: 24,
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
        }}>
          {visibles.map((p) => (
            <div key={p.id} style={{ position: 'relative' }}>
              <Link href={`/programs/${p.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                {/* portada tipográfica */}
                <div style={{
                  position: 'relative', aspectRatio: '16 / 9', overflow: 'hidden',
                  borderRadius: '12px 12px 0 0', border: '1px solid var(--border)', borderBottom: 'none',
                  background: 'linear-gradient(135deg, var(--card) 0%, var(--bg) 100%)',
                  display: 'flex', alignItems: 'flex-end', padding: 14, boxSizing: 'border-box',
                }}>
                  <span aria-hidden style={{
                    position: 'absolute', right: -8, top: -18,
                    fontFamily: 'var(--font-display), sans-serif', fontSize: 130, lineHeight: 1,
                    color: 'transparent', WebkitTextStroke: '1px var(--border)',
                    userSelect: 'none', textTransform: 'uppercase',
                  }}>
                    {p.name.trim().charAt(0)}
                  </span>
                  <h3 className="display" style={{
                    fontSize: 22, margin: 0, lineHeight: 1.05, textTransform: 'uppercase',
                    position: 'relative',
                  }}>
                    {p.name}
                  </h3>
                </div>
                {/* ficha técnica */}
                <div style={{
                  border: '1px solid var(--border)', borderRadius: '0 0 12px 12px',
                  background: 'var(--card)', padding: '10px 14px',
                  display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center',
                }}>
                  {p.level && <Chip texto={p.level.toUpperCase()} />}
                  {p.focus && <Chip texto={p.focus.toUpperCase()} />}
                  <Chip texto={`${p.days} DÍA${p.days === 1 ? '' : 'S'}`} />
                  <Chip texto={p.weeks != null ? `${p.weeks} SEM` : '∞'} />
                </div>
              </Link>
              <div style={{ position: 'absolute', top: 10, right: 10 }}>
                <DeleteProgramButton templateId={p.id} name={p.name} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Chip({ texto }: { texto: string }) {
  return (
    <span style={{
      fontSize: 10, letterSpacing: 1, fontWeight: 700,
      color: 'var(--text-secondary)', border: '1px solid var(--border)',
      borderRadius: 5, padding: '2px 7px', fontFamily: 'var(--font-mono), monospace',
    }}>
      {texto}
    </span>
  );
}
