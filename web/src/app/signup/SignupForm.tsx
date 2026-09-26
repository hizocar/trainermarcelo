'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import { createClient } from '@/lib/supabase-browser';
import { validarNombre } from '@/lib/registro';

// Crear cuenta de coach: nombre, correo y clave (o Google). Con la
// verificación de correo encendida en Supabase, se pide el código de 6
// dígitos; apagada, la sesión llega al tiro. Después: completar_registro
// ('coach') y a completar el perfil.

export default function SignupForm({ google, verificaCorreo }: { google: boolean; verificaCorreo: boolean }) {
  const supabase = createClient();
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [codigo, setCodigo] = useState('');
  const [esperandoCodigo, setEsperandoCodigo] = useState(false);
  const [reenvioEn, setReenvioEn] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [yaExiste, setYaExiste] = useState(false);

  async function terminar() {
    // cuenta creada y con sesión: fija rol y nombre (una sola vez)
    const { error: rpcErr } = await supabase.rpc('completar_registro', { p_rol: 'coach', p_nombre: nombre.trim() });
    if (rpcErr && rpcErr.message !== 'registro_ya_completo') {
      setError(rpcErr.message);
      return;
    }
    router.push('/perfil?completar=1');
    router.refresh();
  }

  function contarReenvio() {
    setReenvioEn(60);
    const t = setInterval(() => setReenvioEn((s) => {
      if (s <= 1) { clearInterval(t); return 0; }
      return s - 1;
    }), 1000);
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setYaExiste(false);
    const errNombre = validarNombre(nombre);
    if (errNombre) { setError(errNombre); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo.trim())) { setError('Revisa tu correo.'); return; }
    if (clave.length < 8) { setError('La clave necesita al menos 8 caracteres.'); return; }

    setCargando(true);
    const { data, error: upErr } = await supabase.auth.signUp({
      email: correo.trim().toLowerCase(),
      password: clave,
      options: { data: { name: nombre.trim() } },
    });
    setCargando(false);
    if (upErr) {
      if (/already registered|already been registered/i.test(upErr.message)) setYaExiste(true);
      else setError(upErr.message);
      return;
    }
    // Supabase no avisa si el correo ya existe cuando la verificación está
    // encendida: devuelve un usuario sin identidades
    if (data.user && (data.user.identities ?? []).length === 0) { setYaExiste(true); return; }
    if (data.session) { await terminar(); return; }
    setEsperandoCodigo(true);
    contarReenvio();
  }

  async function verificar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(codigo.trim())) { setError('El código tiene 6 dígitos.'); return; }
    setCargando(true);
    const { error: vErr } = await supabase.auth.verifyOtp({
      email: correo.trim().toLowerCase(), token: codigo.trim(), type: 'signup',
    });
    setCargando(false);
    if (vErr) { setError('El código no es correcto o venció. Pide uno nuevo.'); return; }
    await terminar();
  }

  async function reenviar() {
    setError(null);
    const { error: rErr } = await supabase.auth.resend({ type: 'signup', email: correo.trim().toLowerCase() });
    if (rErr) setError(rErr.message);
    else contarReenvio();
  }

  async function conGoogle() {
    setError(null);
    const { error: gErr } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (gErr) setError(gErr.message);
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ maxWidth: 460 }}>
        <div className="brand" style={{ marginBottom: 20 }}>
          <Logo />
        </div>

        {esperandoCodigo ? (
          <form onSubmit={verificar}>
            <h1>Revisa tu correo</h1>
            <p className="muted" style={{ fontSize: 14 }}>
              Te mandamos un código de 6 dígitos a <b>{correo.trim().toLowerCase()}</b>.
            </p>
            <div className="field">
              <label htmlFor="codigo">Código</label>
              <input id="codigo" className="input mono" inputMode="numeric" autoComplete="one-time-code"
                maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                placeholder="123456" autoFocus />
            </div>
            {error && <div className="form-error">{error}</div>}
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} disabled={cargando}>
              {cargando ? 'VERIFICANDO…' : 'VERIFICAR'}
            </button>
            <p style={{ marginTop: 14, fontSize: 13 }} className="muted">
              ¿No llegó? Revisa spam o{' '}
              {reenvioEn > 0
                ? <span>pide otro en {reenvioEn} s</span>
                : <button type="button" onClick={reenviar} className="accent" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}>pide otro código</button>}
            </p>
          </form>
        ) : (
          <>
            <h1>Crea tu cuenta de coach</h1>
            <p className="muted" style={{ fontSize: 14 }}>
              3 meses gratis, con hasta 5 alumnos. Sin tarjeta.
            </p>

            {google && (
              <>
                <button type="button" className="btn btn-ghost" style={{ width: '100%', marginTop: 18 }} onClick={conGoogle}>
                  CONTINUAR CON GOOGLE
                </button>
                <p className="muted" style={{ textAlign: 'center', fontSize: 12, margin: '14px 0 0' }}>o con tu correo</p>
              </>
            )}

            <form onSubmit={crear}>
              <div className="field">
                <label htmlFor="nombre">Tu nombre</label>
                <input id="nombre" className="input" value={nombre} onChange={(e) => setNombre(e.target.value)}
                  placeholder="Camila Rojas" autoComplete="name" maxLength={60} />
              </div>
              <div className="field">
                <label htmlFor="correo">Correo</label>
                <input id="correo" className="input" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)}
                  placeholder="camila@correo.com" autoComplete="email" />
              </div>
              <div className="field">
                <label htmlFor="clave">Clave</label>
                <input id="clave" className="input" type="password" value={clave} onChange={(e) => setClave(e.target.value)}
                  placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
              </div>

              {yaExiste && (
                <div className="form-error">
                  Ese correo ya tiene una cuenta. <Link href="/login" className="accent">Inicia sesión</Link>.
                </div>
              )}
              {error && <div className="form-error">{error}</div>}

              <button className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} disabled={cargando}>
                {cargando ? 'CREANDO CUENTA…' : 'CREAR CUENTA'}
              </button>
            </form>

            <p style={{ marginTop: 18, fontSize: 12 }} className="muted">
              {verificaCorreo ? 'Te enviaremos un código para verificar tu correo. ' : ''}
              Al continuar aceptas nuestros <Link href="/terms" className="accent">Términos de uso</Link> y{' '}
              <Link href="/privacy" className="accent">Política de privacidad</Link>.
            </p>
            <p style={{ marginTop: 12, fontSize: 13 }}>
              <Link href="/login" className="muted">¿Ya tienes cuenta? Inicia sesión</Link>
            </p>
            <p style={{ marginTop: 12, fontSize: 13 }} className="muted">
              ¿Quieres entrenar? La cuenta de alumno se crea en la app.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
