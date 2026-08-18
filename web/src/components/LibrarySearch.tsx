'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase-browser';

export interface LibItem {
  id: string;
  name: string;
  name_en: string | null;
  muscle_group: string | null;
  equipment: string | null;
}

/**
 * Buscador contra exercise_library: la única forma de nombrar un ejercicio nuevo.
 *
 * El desplegable se renderiza en un portal a document.body con position: fixed.
 * Motivo: la tabla de ejercicios va dentro de un contenedor con overflow-x: auto,
 * y según la especificación de CSS un overflow-x distinto de visible obliga a
 * overflow-y a recortar también. Un hijo position: absolute quedaba cortado a una
 * franja de pocos píxeles por más z-index que tuviera — es recorte, no apilamiento.
 */
export default function LibrarySearch({
  onPick, onCreate,
}: { onPick: (item: LibItem) => void; onCreate: (query: string) => void }) {
  const supabase = createClient();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<LibItem[]>([]);
  const [closed, setClosed] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const [mounted, setMounted] = useState(false); // el portal solo existe en el cliente
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const open = q.trim().length >= 2 && !closed;

  useEffect(() => {
    setMounted(true);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  // Posición tomada del input: el menú es fixed, así que va en coordenadas de viewport.
  const reposition = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      top: r.bottom + 4,
      left: r.left,
      width: r.width,
      // lo que quede libre hasta el borde inferior; el menú hace scroll interno
      maxHeight: Math.max(120, window.innerHeight - r.bottom - 16),
    });
  }, []);

  // Se reubica al hacer scroll (en cualquier contenedor, por eso capture) y al
  // cambiar el tamaño de la ventana, para que nunca quede flotando lejos del input.
  useEffect(() => {
    if (!open) { setPos(null); return; }
    reposition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, reposition]);

  // Cerrar al hacer clic fuera (el propio input y el menú no cuentan) y con Escape.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      const t = e.target as Node;
      if (inputRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setClosed(true);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setClosed(true);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function onChange(v: string) {
    setQ(v);
    setClosed(false);
    if (timer.current) clearTimeout(timer.current);
    const query = v.trim();
    if (query.length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('exercise_library')
        .select('id, name, name_en, muscle_group, equipment')
        .or(`name.ilike.%${query}%,name_en.ilike.%${query}%`)
        .limit(6);
      setResults((data ?? []) as LibItem[]);
    }, 220);
  }

  const menu = pos && (
    <div
      ref={menuRef}
      className="lib-dropdown"
      style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
    >
      {results.map((r) => (
        <button
          key={r.id}
          type="button"
          className="lib-item"
          onClick={() => { setClosed(true); onPick(r); }}
        >
          <span>{r.name}</span>
          <small>{r.muscle_group}{r.equipment ? ` · ${r.equipment}` : ''}</small>
        </button>
      ))}
      <button
        type="button"
        className="lib-item lib-create"
        onClick={() => { setClosed(true); onCreate(q.trim()); }}
      >
        + Agregar “{q.trim()}” a la biblioteca
      </button>
    </div>
  );

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        className="ex-input"
        value={q}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setClosed(false)}
        placeholder="Buscar en la biblioteca…"
        autoFocus
      />
      {mounted && open && menu && createPortal(menu, document.body)}
    </div>
  );
}
