'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { SERVICIOS } from '@/lib/marketplace';
import { faltantesPerfil, validarNombre } from '@/lib/registro';

export type Profile = {
  name: string | null; marketplace_status: string | null;
  slug: string | null; bio: string | null; instagram: string | null;
  specialties: string[] | null; comunas: string[] | null;
  services: string[] | null; accepting_clients: boolean;
  avatar_url: string | null; en_buscador: boolean;
};

// Deben coincidir con los topes que exige update_my_profile en
// supabase_migration_v20.sql ("demasiadas etiquetas"). Si divergen, el
// coach vuelve a poder escribir algo que el cliente aprueba y el SQL rechaza.
const MAX_ESPECIALIDADES = 6;
const MAX_COMUNAS = 10;
const MAX_FOTO_MB = 5;

const lista = (s: string) =>
  s.split(',').map((x) => x.trim()).filter(Boolean);

/**
 * El perfil de coach. Obligatorio desde el registro propio (v49): foto,
 * descripción, especialidad y modalidad (más comunas si es presencial) — la
 * misma regla que users.perfil_coach_completo. `completar` es el modo al que
 * manda el guardia a un coach con el perfil incompleto: al guardarlo completo,
 * entra a su panel.
 */
export default function ProfileForm({
  initial, userId, completar = false,
}: { initial: Profile; userId: string; completar?: boolean }) {
  const router = useRouter();
  // el alta usaba el correo como nombre: ese valor no se ofrece como nombre
  const [name, setName] = useState((initial.name ?? '').includes('@') ? '' : (initial.name ?? ''));
  const [bio, setBio] = useState(initial.bio ?? '');
  const [instagram, setInstagram] = useState(initial.instagram ?? '');
  const [specialties, setSpecialties] = useState((initial.specialties ?? []).join(', '));
  const [comunas, setComunas] = useState((initial.comunas ?? []).join(', '));
  const [services, setServices] = useState<string[]>(initial.services ?? []);
  const [accepting, setAccepting] = useState(initial.accepting_clients);
  const [enBuscador, setEnBuscador] = useState(completar ? true : initial.en_buscador);
  const [foto, setFoto] = useState<string | null>(initial.avatar_url);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const especialidadesCount = lista(specialties).length;
  const comunasCount = lista(comunas).length;

  async function subirFoto(file: File) {
    if (!file.type.startsWith('image/')) { setErrorMsg('La foto tiene que ser una imagen.'); setState('error'); return; }
    if (file.size > MAX_FOTO_MB * 1024 * 1024) { setErrorMsg(`La foto pesa más de ${MAX_FOTO_MB} MB.`); setState('error'); return; }
    setSubiendoFoto(true);
    setErrorMsg(null);
    const supabase = createClient();
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    // la primera carpeta es el uid: es lo que exige la política de avatars
    const ruta = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(ruta, file, { contentType: file.type, upsert: true });
    if (upErr) { setSubiendoFoto(false); setErrorMsg('No se pudo subir la foto. Inténtalo de nuevo.'); setState('error'); return; }
    const url = supabase.storage.from('avatars').getPublicUrl(ruta).data.publicUrl;
    const { error: updErr } = await supabase.from('users').update({ avatar_url: url }).eq('id', userId);
    setSubiendoFoto(false);
    if (updErr) { setErrorMsg('No se pudo guardar la foto. Inténtalo de nuevo.'); setState('error'); return; }
    setFoto(url);
    if (state === 'error') setState('idle');
  }

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
    const errNombre = validarNombre(name);
    if (errNombre) { setErrorMsg(errNombre); setState('error'); return; }

    const falta = faltantesPerfil({
      avatar_url: foto, bio, specialties: lista(specialties), services, comunas: lista(comunas),
    });
    if (falta.length > 0) {
      setErrorMsg(`Para completar tu perfil falta: ${falta.join(', ')}.`);
      setState('error');
      return;
    }

    setState('saving');
    setErrorMsg(null);
    const supabase = createClient();
    const { error } = await supabase.rpc('update_my_profile', {
      p_bio: bio, p_instagram: instagram,
      p_specialties: lista(specialties), p_comunas: lista(comunas),
      p_services: services, p_accepting: accepting, p_name: name.trim(),
      p_en_buscador: enBuscador,
    });
    if (error) {
      // los mensajes de validación del servidor (P0001) están escritos para el coach
      setErrorMsg(error.code === 'P0001' ? error.message : 'No se pudo guardar. Inténtalo de nuevo.');
      setState('error');
      return;
    }
    setState('saved');
    if (completar) {
      router.push('/dashboard');
    }
    router.refresh(); // el estado de la vitrina puede haber cambiado
  }

  return (
    <form onSubmit={save} style={{ display: 'grid', maxWidth: 520 }}>
      <div className="field">
        <label>Tu foto</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
            background: 'var(--surface)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {foto
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={foto} alt="Tu foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span className="muted" style={{ fontSize: 11 }}>Sin foto</span>}
          </div>
          <label className="btn btn-ghost" style={{ padding: '10px 16px', fontSize: 12, cursor: 'pointer' }}>
            {subiendoFoto ? 'SUBIENDO…' : foto ? 'CAMBIAR FOTO' : 'SUBIR FOTO'}
            <input type="file" accept="image/*" hidden disabled={subiendoFoto}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) subirFoto(f); e.target.value = ''; }} />
          </label>
        </div>
      </div>

      <div className="field">
        <label htmlFor="perfil-nombre">Tu nombre</label>
        <input id="perfil-nombre" className="input" value={name} maxLength={60}
               onChange={(e) => setName(e.target.value)}
               placeholder="Camila Rojas" autoComplete="name" />
        <small className="muted" style={{ fontSize: 12 }}>Lo ven tus alumnos en la app y quienes visitan tu página.</small>
      </div>

      <div className="field">
        <label htmlFor="perfil-bio">Sobre ti</label>
        <textarea id="perfil-bio" className="input" rows={5} maxLength={800} value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Cómo trabajas, con quién, desde cuándo." />
      </div>

      <div className="field">
        <label>
          Especialidades (separadas por coma) — {especialidadesCount}/{MAX_ESPECIALIDADES}
        </label>
        <input className="input" value={specialties} onChange={(e) => setSpecialties(e.target.value)}
               placeholder="Fuerza, Pérdida de grasa, Rehabilitación" />
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

      <div className="field">
        <label>
          Comunas donde atiendes (separadas por coma) — {comunasCount}/{MAX_COMUNAS}
        </label>
        <input className="input" value={comunas} onChange={(e) => setComunas(e.target.value)}
               placeholder="Ñuñoa, Providencia" />
        <small className="muted" style={{ fontSize: 12 }}>Obligatorio si entrenas en gimnasio o a domicilio.</small>
      </div>

      <div className="field">
        <label>Instagram (opcional)</label>
        <input className="input" value={instagram} onChange={(e) => setInstagram(e.target.value)}
               placeholder="tu_usuario" />
      </div>

      <div className="field" style={{
        border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', background: 'var(--card)',
      }}>
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: 0, cursor: 'pointer' }}>
          <input type="checkbox" checked={enBuscador} onChange={(e) => setEnBuscador(e.target.checked)} style={{ marginTop: 3 }} />
          <span>
            <b style={{ color: 'var(--text)' }}>Aparecer en el buscador</b>
            <span className="muted" style={{ display: 'block', fontSize: 13, marginTop: 2 }}>
              Los alumnos que buscan coach te encuentran y te escriben. Revisamos tu perfil antes de
              mostrarlo. Apagado, solo te ven tus propios alumnos.
            </span>
          </span>
        </label>
      </div>

      <div className="field" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input id="perfil-acepta" type="checkbox" checked={accepting}
               onChange={(e) => setAccepting(e.target.checked)} />
        <label htmlFor="perfil-acepta" style={{ margin: 0 }}>Estoy recibiendo alumnos nuevos</label>
      </div>

      {state === 'error' && errorMsg && <div className="form-error">{errorMsg}</div>}

      <button className="btn btn-primary" disabled={state === 'saving' || subiendoFoto} style={{ marginTop: 24 }}>
        {state === 'saving' ? 'GUARDANDO…' : completar ? 'GUARDAR Y ENTRAR' : 'GUARDAR'}
      </button>

      {state === 'saved' && !completar && <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>Guardado.</p>}

      {initial.slug && (
        <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
          Tu página: <a href={`/coach/${initial.slug}`}>elitefitapp.com/coach/{initial.slug}</a>
        </p>
      )}
    </form>
  );
}
