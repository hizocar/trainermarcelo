'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

// Video de técnica del ejercicio, desde el editor (lo que el coach graba en
// el gimnasio y el alumno ve en su app). Sube al bucket exercise-media — el
// mismo que usa la app — y el path parte con el uid porque así lo exigen las
// políticas del bucket. La URL queda en el modelo de edición y viaja con el
// guardado normal del plan.

const MAX_BYTES = 50 * 1024 * 1024; // mismo límite que la app (media.ts)

export default function ExerciseVideoCell({
  videoUrl, uid, onChange,
}: { videoUrl: string | null; uid: string | null; onChange: (url: string | null) => void }) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [ver, setVer] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subir(file: File) {
    if (!uid) { setError('Sesión expirada — recarga la página.'); return; }
    if (file.size > MAX_BYTES) { setError('El video supera el máximo de 50MB.'); return; }
    setSubiendo(true);
    setError(null);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
    const path = `${uid}/web_${Date.now()}.${ext}`;
    const { error: err } = await supabase.storage
      .from('exercise-media')
      .upload(path, file, { contentType: file.type || 'video/mp4', upsert: true });
    setSubiendo(false);
    if (err) { setError(err.message); return; }
    const { data } = supabase.storage.from('exercise-media').getPublicUrl(path);
    // cache-bust, igual que uploadMedia en la app
    onChange(`${data.publicUrl}?v=${Date.now()}`);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <input
        ref={fileRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f); e.target.value = ''; }}
      />
      {videoUrl ? (
        <>
          <button className="icon-btn" title="Ver el video que ve tu alumno" onClick={() => setVer(true)}>▶</button>
          <button className="icon-btn" title="Reemplazar video" disabled={subiendo}
            onClick={() => fileRef.current?.click()}>
            {subiendo ? '…' : '⟳'}
          </button>
          <button className="icon-btn" title="Quitar video" onClick={() => onChange(null)}>✕</button>
        </>
      ) : (
        <button
          className="icon-btn"
          style={{ width: 'auto', padding: '0 8px', fontSize: 11, letterSpacing: 1 }}
          title="Subir un video de técnica (máx. 50MB) — tu alumno lo ve en su app"
          disabled={subiendo}
          onClick={() => fileRef.current?.click()}
        >
          {subiendo ? 'SUBIENDO…' : '+ VIDEO'}
        </button>
      )}
      {error && <span style={{ fontSize: 11, color: 'var(--warning)' }}>{error}</span>}

      {ver && videoUrl && (
        <div className="modal-overlay" onClick={() => setVer(false)}>
          <div className="modal-card" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={videoUrl} controls autoPlay playsInline style={{ width: '100%', borderRadius: 10 }} />
            <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => setVer(false)}>CERRAR</button>
          </div>
        </div>
      )}
    </div>
  );
}
