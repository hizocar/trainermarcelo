'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

export type Profile = {
  slug: string | null; bio: string | null; instagram: string | null;
  specialties: string[] | null; comunas: string[] | null;
  modality: string | null; accepting_clients: boolean;
};

const lista = (s: string) =>
  s.split(',').map((x) => x.trim()).filter(Boolean);

export default function ProfileForm({ initial }: { initial: Profile }) {
  const [bio, setBio] = useState(initial.bio ?? '');
  const [instagram, setInstagram] = useState(initial.instagram ?? '');
  const [specialties, setSpecialties] = useState((initial.specialties ?? []).join(', '));
  const [comunas, setComunas] = useState((initial.comunas ?? []).join(', '));
  const [modality, setModality] = useState(initial.modality ?? 'ambas');
  const [accepting, setAccepting] = useState(initial.accepting_clients);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState('saving');
    const supabase = createClient();
    const { error } = await supabase.rpc('update_my_profile', {
      p_bio: bio, p_instagram: instagram,
      p_specialties: lista(specialties), p_comunas: lista(comunas),
      p_modality: modality, p_accepting: accepting,
    });
    setState(error ? 'error' : 'saved');
  }

  return (
    <form onSubmit={save} style={{ display: 'grid', maxWidth: 520 }}>
      <div className="field">
        <label>Sobre ti</label>
        <textarea className="input" rows={5} maxLength={800} value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Cómo trabajas, con quién, desde cuándo." />
      </div>

      <div className="field">
        <label>Instagram</label>
        <input className="input" value={instagram} onChange={(e) => setInstagram(e.target.value)}
               placeholder="tu_usuario" />
      </div>

      <div className="field">
        <label>Especialidades (separadas por coma)</label>
        <input className="input" value={specialties} onChange={(e) => setSpecialties(e.target.value)}
               placeholder="Fuerza, Pérdida de grasa, Rehabilitación" />
      </div>

      <div className="field">
        <label>Comunas donde atiendes (separadas por coma)</label>
        <input className="input" value={comunas} onChange={(e) => setComunas(e.target.value)}
               placeholder="Ñuñoa, Providencia" />
      </div>

      <div className="field">
        <label>Modalidad</label>
        <select className="input" value={modality} onChange={(e) => setModality(e.target.value)}>
          <option value="presencial">Presencial</option>
          <option value="online">Online</option>
          <option value="ambas">Presencial y online</option>
        </select>
      </div>

      <div className="field" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={accepting}
               onChange={(e) => setAccepting(e.target.checked)} />
        <label style={{ margin: 0 }}>Estoy recibiendo alumnos nuevos</label>
      </div>

      {state === 'error' && <div className="form-error">No se pudo guardar. Inténtalo de nuevo.</div>}

      <button className="btn btn-primary" disabled={state === 'saving'} style={{ marginTop: 24 }}>
        {state === 'saving' ? 'GUARDANDO…' : 'GUARDAR'}
      </button>

      {state === 'saved' && <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>Guardado.</p>}

      {initial.slug && (
        <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
          Tu página: <a href={`/coach/${initial.slug}`}>elitefitapp.com/coach/{initial.slug}</a>
        </p>
      )}
    </form>
  );
}
