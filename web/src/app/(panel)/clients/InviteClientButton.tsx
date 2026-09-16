'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { firstToken } from '@/lib/env';

// "+ CLIENTE" en la web: crea la cuenta del alumno con la MISMA edge function
// que usa la app (invite-client), que valida que quien llama sea coach, crea
// el usuario ya confirmado y lo vincula a este coach. Al terminar muestra un
// mensaje listo para copiar y mandarle al alumno por WhatsApp.

const APP_STORE = 'https://apps.apple.com/app/id6788209434';

function claveTemporal(): string {
  // sin caracteres ambiguos (0/O, 1/l/I) — se va a dictar o tipear en un iPhone
  const alfabeto = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint32Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('');
}

export default function InviteClientButton({ variant = 'primary' }: { variant?: 'primary' | 'ghost' }) {
  const supabase = createClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creado, setCreado] = useState<{ name: string; email: string; password: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  function abrir() {
    setName(''); setEmail(''); setPassword(claveTemporal());
    setError(null); setCreado(null); setCopiado(false);
    setOpen(true);
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    const m = email.trim().toLowerCase();
    if (!n || !m || !password) { setError('Completa nombre, correo y clave temporal.'); return; }
    if (password.length < 8) { setError('La clave temporal necesita al menos 8 caracteres.'); return; }

    setSaving(true);
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError('Tu sesión expiró. Vuelve a entrar.'); setSaving(false); return; }

    try {
      const res = await fetch(`${firstToken(process.env.NEXT_PUBLIC_SUPABASE_URL)}/functions/v1/invite-client`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: firstToken(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        },
        body: JSON.stringify({ name: n, email: m, password }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.error) {
        setError(result.error ?? `No se pudo crear la cuenta (error ${res.status}).`);
      } else {
        setCreado({ name: n, email: m, password });
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error de conexión. Intenta de nuevo.');
    }
    setSaving(false);
  }

  const mensaje = creado
    ? `Hola ${creado.name.split(' ')[0]}! Ya tienes tu cuenta en EliteFitness 💪\n\n` +
      `1) Descarga la app: ${APP_STORE}\n` +
      `2) Entra con:\nCorreo: ${creado.email}\nClave: ${creado.password}\n\n` +
      `Al entrar, cambia tu clave en Perfil → Ajustes.`
    : '';

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensaje);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`btn ${variant === 'primary' ? 'btn-primary' : 'btn-ghost'}`}
        style={{ padding: '10px 18px' }}
        onClick={abrir}
      >
        + CLIENTE
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => !saving && setOpen(false)}>
          <div className="modal-card" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            {!creado ? (
              <form onSubmit={crear}>
                <h3 style={{ marginBottom: 4 }}>Nuevo alumno</h3>
                <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
                  Creas su cuenta con una clave temporal; queda vinculado a ti al instante.
                  Después le mandas sus datos para que entre a la app.
                </p>
                <div className="field">
                  <label htmlFor="inv-nombre">Nombre</label>
                  <input id="inv-nombre" className="input" value={name} autoFocus
                    onChange={(e) => setName(e.target.value)} placeholder="Camila Rojas" />
                </div>
                <div className="field">
                  <label htmlFor="inv-correo">Correo</label>
                  <input id="inv-correo" className="input" type="email" value={email} autoComplete="off"
                    onChange={(e) => setEmail(e.target.value)} placeholder="camila@correo.com" />
                </div>
                <div className="field">
                  <label htmlFor="inv-clave">Clave temporal</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input id="inv-clave" className="input mono" value={password} autoComplete="off"
                      onChange={(e) => setPassword(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
                    <button type="button" className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: 11 }}
                      onClick={() => setPassword(claveTemporal())} title="Generar otra clave">
                      OTRA
                    </button>
                  </div>
                  <small className="muted" style={{ fontSize: 11 }}>Mínimo 8 caracteres. El alumno la cambia al entrar.</small>
                </div>

                {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}
                <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-ghost" style={{ padding: '10px 16px' }}
                    onClick={() => setOpen(false)} disabled={saving}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" style={{ padding: '10px 16px' }} disabled={saving}>
                    {saving ? 'CREANDO…' : 'CREAR CUENTA'}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <h3 style={{ marginBottom: 4 }}>{creado.name} ya tiene cuenta ✓</h3>
                <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
                  Mándale este mensaje — la clave no se vuelve a mostrar.
                </p>
                <pre className="mono" style={{
                  whiteSpace: 'pre-wrap', fontSize: 12.5, lineHeight: 1.5,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: 12, margin: 0,
                }}>{mensaje}</pre>
                <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <a className="btn btn-ghost" style={{ padding: '10px 16px' }}
                    href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener noreferrer">
                    WHATSAPP
                  </a>
                  <button type="button" className="btn btn-ghost" style={{ padding: '10px 16px' }} onClick={copiar}>
                    {copiado ? 'COPIADO ✓' : 'COPIAR'}
                  </button>
                  <button type="button" className="btn btn-primary" style={{ padding: '10px 16px' }} onClick={() => setOpen(false)}>
                    LISTO
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
