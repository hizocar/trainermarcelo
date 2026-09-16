'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { SERVICIOS } from '@/lib/marketplace';

export type Profile = {
  name: string | null; marketplace_status: string | null;
  slug: string | null; bio: string | null; instagram: string | null;
  specialties: string[] | null; comunas: string[] | null;
  services: string[] | null; accepting_clients: boolean;
};

// Deben coincidir con los topes que exige update_my_profile en
// supabase_migration_v20.sql ("demasiadas etiquetas"). Si divergen, el
// coach vuelve a poder escribir algo que el cliente aprueba y el SQL rechaza.
const MAX_ESPECIALIDADES = 6;
const MAX_COMUNAS = 10;

const lista = (s: string) =>
  s.split(',').map((x) => x.trim()).filter(Boolean);

export default function ProfileForm({ initial }: { initial: Profile }) {
  const router = useRouter();
  // el alta usaba el correo como nombre: ese valor no se ofrece como nombre
  const [name, setName] = useState((initial.name ?? '').includes('@') ? '' : (initial.name ?? ''));
  const [bio, setBio] = useState(initial.bio ?? '');
  const [instagram, setInstagram] = useState(initial.instagram ?? '');
  const [specialties, setSpecialties] = useState((initial.specialties ?? []).join(', '));
  const [comunas, setComunas] = useState((initial.comunas ?? []).join(', '));
  const [services, setServices] = useState<string[]>(initial.services ?? []);
  const [accepting, setAccepting] = useState(initial.accepting_clients);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const especialidadesCount = lista(specialties).length;
  const comunasCount = lista(comunas).length;

  async function save(e: React.FormEvent) {
    e.preventDefault();

    if (especialidadesCount > MAX_ESPECIALIDADES) {
      setErrorMsg(`Máximo ${MAX_ESPECIALIDADES} especialidades. Tienes ${especialidadesCount}: quita algunas.`);
      setState('error');
      return;
    }
    if (comunasCount > MAX_COMUNAS) {
      setErrorMsg(`Máximo ${MAX_COMUNAS} comunas. Tienes ${comunasCount}: quita algunas.`);
      setState('error');
      return;
    }

    const nombre = name.trim();
    if (nombre.length < 2 || nombre.length > 60) {
      setErrorMsg('Escribe tu nombre (entre 2 y 60 caracteres): es el que ven tus alumnos y el directorio.');
      setState('error');
      return;
    }
    if (nombre.includes('@')) {
      setErrorMsg('Usa tu nombre, no tu correo.');
      setState('error');
      return;
    }

    setState('saving');
    setErrorMsg(null);
    const supabase = createClient();
    const { error } = await supabase.rpc('update_my_profile', {
      p_bio: bio, p_instagram: instagram,
      p_specialties: lista(specialties), p_comunas: lista(comunas),
      p_services: services, p_accepting: accepting, p_name: nombre,
    });
    if (error) {
      // los mensajes de validación del servidor (P0001) están escritos para el coach
      setErrorMsg(error.code === 'P0001' ? error.message : 'No se pudo guardar. Inténtalo de nuevo.');
      setState('error');
    } else {
      setState('saved');
      router.refresh(); // el estado de la vitrina puede haber pasado a "En revisión"
    }
  }

  return (
    <form onSubmit={save} style={{ display: 'grid', maxWidth: 520 }}>
      <div className="field">
        <label htmlFor="perfil-nombre">Tu nombre</label>
        <input id="perfil-nombre" className="input" value={name} maxLength={60}
               onChange={(e) => setName(e.target.value)}
               placeholder="Yharel Martínez" autoComplete="name" />
        <small className="muted" style={{ fontSize: 12 }}>Lo ven tus alumnos en la app y quienes visitan tu página.</small>
      </div>

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
        <label>
          Especialidades (separadas por coma) — {especialidadesCount}/{MAX_ESPECIALIDADES}
        </label>
        <input className="input" value={specialties} onChange={(e) => setSpecialties(e.target.value)}
               placeholder="Fuerza, Pérdida de grasa, Rehabilitación" />
      </div>

      <div className="field">
        <label>
          Comunas donde atiendes (separadas por coma) — {comunasCount}/{MAX_COMUNAS}
        </label>
        <input className="input" value={comunas} onChange={(e) => setComunas(e.target.value)}
               placeholder="Ñuñoa, Providencia" />
      </div>

      <div className="field">
        <label>¿Cómo entrenas? (marca todas las que apliquen)</label>
        <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
          {SERVICIOS.map(([value, label]) => (
            <label key={value} style={{ display: 'flex', gap: 8, alignItems: 'center', margin: 0 }}>
              <input type="checkbox" checked={services.includes(value)}
                     onChange={(e) => setServices((prev) =>
                       e.target.checked ? [...prev, value] : prev.filter((v) => v !== value))} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="field" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={accepting}
               onChange={(e) => setAccepting(e.target.checked)} />
        <label style={{ margin: 0 }}>Estoy recibiendo alumnos nuevos</label>
      </div>

      {state === 'error' && errorMsg && <div className="form-error">{errorMsg}</div>}

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
