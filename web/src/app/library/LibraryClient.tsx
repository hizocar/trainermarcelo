'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

const MUSCLE_GROUPS = [
  'Pecho', 'Espalda alta', 'Espalda baja',
  'Hombro anterior', 'Hombro medial', 'Hombro posterior',
  'Bíceps', 'Tríceps', 'Antebrazos',
  'Cuádriceps', 'Isquiotibiales', 'Aductor',
  'Glúteo mayor', 'Glúteo medio', 'Glúteo menor',
  'Gastrocnemios', 'Core',
];

interface LibItem {
  id: string;
  name: string;
  name_en: string | null;
  muscle_group: string | null;
  equipment: string | null;
  coach_id: string | null;
}

export default function LibraryClient({ initialLibrary, coachId }: { initialLibrary: LibItem[]; coachId: string }) {
  const supabase = createClient();
  const [items, setItems] = useState<LibItem[]>(initialLibrary);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [muscle, setMuscle] = useState('');
  const [equipment, setEquipment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      i.name.toLowerCase().includes(q) ||
      (i.name_en ?? '').toLowerCase().includes(q) ||
      (i.muscle_group ?? '').toLowerCase().includes(q));
  }, [items, query]);

  const grouped = useMemo(() => {
    const byGroup = new Map<string, LibItem[]>();
    filtered.forEach((i) => {
      const g = i.muscle_group?.trim() || 'Sin grupo';
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g)!.push(i);
    });
    return Array.from(byGroup.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  async function addExercise() {
    if (!name.trim()) { setError('Ponle un nombre al ejercicio.'); return; }
    if (!muscle) { setError('Elige el grupo muscular.'); return; }
    setSaving(true);
    setError(null);
    const { data, error: insErr } = await supabase
      .from('exercise_library')
      .insert({
        name: name.trim(),
        name_en: nameEn.trim() || null,
        muscle_group: muscle,
        equipment: equipment.trim() || null,
        coach_id: coachId,
      })
      .select('id, name, name_en, muscle_group, equipment, coach_id')
      .single();
    setSaving(false);
    if (insErr) { setError(insErr.message); return; }
    setItems((prev) => [...prev, data as LibItem]);
    setName(''); setNameEn(''); setMuscle(''); setEquipment('');
    setShowForm(false);
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
        <input
          className="input"
          style={{ maxWidth: 320 }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar ejercicio o grupo muscular…"
        />
        <button className="btn btn-primary" style={{ padding: '11px 18px' }} onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'CANCELAR' : '+ NUEVO EJERCICIO'}
        </button>
        <span className="muted" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
          {items.length} en la biblioteca
        </span>
      </div>

      {showForm && (
        <div className="editor-day" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 4 }}>Nuevo ejercicio</h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
            Queda disponible para todos tus planes y clientes.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div className="field">
              <label>Nombre</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ej: Press banca" />
            </div>
            <div className="field">
              <label>Nombre en inglés (opcional)</label>
              <input className="input" value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="ej: Bench press" />
            </div>
            <div className="field">
              <label>Grupo muscular</label>
              <select className="input" value={muscle} onChange={(e) => setMuscle(e.target.value)}>
                <option value="">Elegir…</option>
                {MUSCLE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Equipo (opcional)</label>
              <input className="input" value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="barra, mancuerna, máquina…" />
            </div>
          </div>
          {error && <div className="form-error">{error}</div>}
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={addExercise} disabled={saving}>
            {saving ? 'AGREGANDO…' : 'AGREGAR A LA BIBLIOTECA'}
          </button>
        </div>
      )}

      {grouped.length === 0 ? (
        <p className="muted">Sin resultados.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {grouped.map(([group, list]) => (
            <div key={group}>
              <h3 style={{ fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
                {group} <span style={{ fontFamily: 'var(--font-mono)' }}>· {list.length}</span>
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {list.map((i) => (
                  <div key={i.id} className="client-card" style={{ cursor: 'default', padding: 16 }}>
                    <h3 style={{ fontSize: 15 }}>{i.name}</h3>
                    <small>
                      {i.name_en ? `${i.name_en} · ` : ''}{i.equipment || 'Sin equipo especificado'}
                    </small>
                    {i.coach_id === coachId && (
                      <div style={{ marginTop: 8 }}>
                        <span className="price-flag" style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                          Agregado por ti
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
