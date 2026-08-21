'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

// El alumno opina con su MISMA cuenta de la app — así la base puede verificar
// que de verdad entrena con este coach (submit_review compara users.coach_id;
// acá no se decide nada de eso, solo se recoge la sesión y el texto).
export default function ReviewForm({ slug, coachName }: { slug: string; coachName: string }) {
  const supabase = createClient();
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setSessionEmail(data.user?.email ?? null);
      setChecking(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) { setError('Correo o contraseña incorrectos.'); return; }
    setSessionEmail(email);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (body.trim().length < 20) {
      setError('Cuéntanos un poco más — al menos un par de frases.');
      return;
    }
    setLoading(true);
    const { error: rpcError } = await supabase.rpc('submit_review', {
      p_coach_slug: slug, p_body: body.trim(),
    });
    setLoading(false);
    if (rpcError) {
      // El único caso esperable: entró con una cuenta que no es alumna de
      // este coach. El resto se muestra genérico.
      setError(
        rpcError.message.includes('solo sus alumnos')
          ? `Esta cuenta no aparece como alumno de ${coachName}. Entra con la cuenta que usas en la app.`
          : 'No se pudo publicar. Inténtalo de nuevo.',
      );
      return;
    }
    setDone(true);
  }

  if (checking) return null;

  if (done) {
    return (
      <div className="auth-card" style={{ maxWidth: 460 }}>
        <h1>Publicado</h1>
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
          Tu comentario ya está en la ficha de {coachName}. Si quieres cambiarlo,
          vuelve acá y escríbelo de nuevo: el nuevo reemplaza al anterior.
        </p>
        <a className="btn btn-primary" href={`/coach/${slug}`} style={{ marginTop: 20 }}>
          VER LA FICHA
        </a>
      </div>
    );
  }

  if (!sessionEmail) {
    return (
      <form className="auth-card" style={{ maxWidth: 460 }} onSubmit={login}>
        <h1>¿Entrenas con {coachName}?</h1>
        <p className="muted" style={{ fontSize: 14 }}>
          Entra con la misma cuenta que usas en la app y deja tu comentario.
          Solo sus alumnos pueden opinar — por eso vale.
        </p>
        <div className="field">
          <label>Correo</label>
          <input className="input" type="email" value={email}
                 onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>Contraseña</label>
          <input className="input" type="password" value={password}
                 onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <div className="form-error">{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={loading}
                style={{ width: '100%', marginTop: 20 }}>
          {loading ? 'ENTRANDO…' : 'ENTRAR'}
        </button>
      </form>
    );
  }

  return (
    <form className="auth-card" style={{ maxWidth: 460 }} onSubmit={submit}>
      <h1>Tu comentario</h1>
      <p className="muted" style={{ fontSize: 14 }}>
        Saldrá en la ficha de {coachName} con tu nombre de pila y la insignia
        de alumno verificado. Estás dentro como {sessionEmail}.
      </p>
      <div className="field">
        <label>¿Cómo ha sido entrenar con {coachName}?</label>
        <textarea className="input" rows={5} value={body} maxLength={600}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Qué buscabas, cómo te ha acompañado, qué ha cambiado…" required />
      </div>
      {error && <div className="form-error">{error}</div>}
      <button className="btn btn-primary" type="submit" disabled={loading}
              style={{ width: '100%', marginTop: 20 }}>
        {loading ? 'PUBLICANDO…' : 'PUBLICAR MI COMENTARIO'}
      </button>
    </form>
  );
}
