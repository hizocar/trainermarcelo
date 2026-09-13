'use client';

import MiniBody from '@/components/MiniBody';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { type VideoLib } from '@/lib/videoBiblioteca';
import { normalizar } from '@/lib/libraryRank';

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
  // biblioteca de videos (v41): los visibles para mí (míos + públicos)
  const [videos, setVideos] = useState<(VideoLib & { id: string; storage_path: string | null })[]>([]);
  const [verVideo, setVerVideo] = useState<string | null>(null);
  const [subiendoVideo, setSubiendoVideo] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('library_videos').select('id, library_id, coach_id, video_url, is_public, storage_path')
      .then(({ data, error: err }) => {
        if (err) setError(`No se pudieron cargar los videos: ${err.message}`);
        else setVideos((data ?? []) as any);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function subirVideo(item: LibItem, file: File) {
    if (file.size > 50 * 1024 * 1024) { setError('El video supera el máximo de 50MB.'); return; }
    setSubiendoVideo(item.id);
    setError(null);
    const previo = videos.find(v => v.library_id === item.id && v.coach_id === coachId);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
    const path = `${coachId}/lib_${item.id}_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('exercise-media')
      .upload(path, file, { contentType: file.type || 'video/mp4', upsert: true });
    if (upErr) { setError(upErr.message); setSubiendoVideo(null); return; }
    const { data: pub } = supabase.storage.from('exercise-media').getPublicUrl(path);
    const { data: fila, error: insErr } = await supabase.from('library_videos')
      .upsert({
        library_id: item.id, coach_id: coachId,
        video_url: `${pub.publicUrl}?v=${Date.now()}`, storage_path: path,
        is_public: previo?.is_public ?? false,
      }, { onConflict: 'library_id,coach_id' })
      .select('id, library_id, coach_id, video_url, is_public, storage_path').single();
    setSubiendoVideo(null);
    if (insErr || !fila) { setError(insErr?.message ?? 'No se pudo guardar el video.'); return; }
    if (previo?.storage_path && previo.storage_path !== path) {
      supabase.storage.from('exercise-media').remove([previo.storage_path]);
    }
    setVideos(prev => [...prev.filter(v => !(v.library_id === item.id && v.coach_id === coachId)), fila as any]);
  }

  async function cambiarVisibilidad(video: (typeof videos)[number]) {
    const { error: err } = await supabase.from('library_videos')
      .update({ is_public: !video.is_public }).eq('id', video.id);
    if (err) { setError(err.message); return; }
    setVideos(prev => prev.map(v => v.id === video.id ? { ...v, is_public: !v.is_public } : v));
  }

  async function quitarVideo(video: (typeof videos)[number]) {
    if (!window.confirm('¿Quitar tu video de este ejercicio? Los planes donde ya lo copiaste lo conservan.')) return;
    const { error: err } = await supabase.from('library_videos').delete().eq('id', video.id);
    if (err) { setError(err.message); return; }
    if (video.storage_path) supabase.storage.from('exercise-media').remove([video.storage_path]);
    setVideos(prev => prev.filter(v => v.id !== video.id));
  }

  const filtered = useMemo(() => {
    const q = normalizar(query);
    if (!q) return items;
    return items.filter((i) =>
      normalizar(i.name).includes(q) ||
      normalizar(i.name_en ?? '').includes(q) ||
      normalizar(i.muscle_group ?? '').includes(q));
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <MiniBody grupo={group} height={44} />
                <h3 style={{ fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>
                  {group} <span style={{ fontFamily: 'var(--font-mono)' }}>· {list.length}</span>
                </h3>
              </div>
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
                    {(() => {
                      const mio = videos.find(v => v.library_id === i.id && v.coach_id === coachId);
                      const publico = videos.find(v => v.library_id === i.id && v.is_public && v.coach_id !== coachId);
                      return (
                        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          {mio ? (
                            <>
                              <button className="icon-btn" title="Ver tu video" onClick={() => setVerVideo(mio.video_url)}>▶</button>
                              <button
                                className="icon-btn"
                                style={{ width: 'auto', padding: '0 8px', fontSize: 10, letterSpacing: 1,
                                  ...(mio.is_public ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}) }}
                                title={mio.is_public
                                  ? 'PÚBLICO: todos los coaches y alumnos pueden heredarlo — clic para hacerlo privado'
                                  : 'PRIVADO: solo tú y tus alumnos — clic para hacerlo público'}
                                onClick={() => cambiarVisibilidad(mio)}
                              >
                                {mio.is_public ? 'PÚBLICO' : 'PRIVADO'}
                              </button>
                              <button className="icon-btn" title="Quitar tu video" onClick={() => quitarVideo(mio)}>✕</button>
                            </>
                          ) : (
                            <label className="icon-btn" style={{ width: 'auto', padding: '0 8px', fontSize: 10, letterSpacing: 1, cursor: 'pointer' }}
                              title="Sube tu video de técnica (máx. 50MB); nace privado — solo tú y tus alumnos">
                              {subiendoVideo === i.id ? 'SUBIENDO…' : '+ VIDEO'}
                              <input type="file" accept="video/mp4,video/quicktime,video/webm" style={{ display: 'none' }}
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) subirVideo(i, f); e.target.value = ''; }} />
                            </label>
                          )}
                          {publico && (
                            <button className="icon-btn" style={{ width: 'auto', padding: '0 8px', fontSize: 10, letterSpacing: 1 }}
                              title="Video público de otro coach — se hereda al agregar el ejercicio si no tienes uno propio"
                              onClick={() => setVerVideo(publico.video_url)}>
                              ▶ PÚBLICO
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {verVideo && (
        <div className="modal-overlay" onClick={() => setVerVideo(null)}>
          <div className="modal-card" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={verVideo} controls autoPlay playsInline style={{ width: '100%', borderRadius: 10 }} />
            <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => setVerVideo(null)}>CERRAR</button>
          </div>
        </div>
      )}
    </div>
  );
}
