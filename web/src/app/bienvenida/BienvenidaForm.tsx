'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import { createClient } from '@/lib/supabase-browser';
import { validarNombre } from '@/lib/registro';
import { signOut } from '@/app/actions';

export default function BienvenidaForm({ nombreSugerido }: { nombreSugerido: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [nombre, setNombre] = useState(nombreSugerido);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function continuar(e: React.FormEvent) {
    e.preventDefault();
    const errNombre = validarNombre(nombre);
    if (errNombre) { setError(errNombre); return; }
    setCargando(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc('completar_registro', { p_rol: 'coach', p_nombre: nombre.trim() });
    setCargando(false);
    if (rpcErr && rpcErr.message !== 'registro_ya_completo') { setError(rpcErr.message); return; }
    router.push('/perfil?completar=1');
    router.refresh();
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ maxWidth: 460 }}>
        <div className="brand" style={{ marginBottom: 20 }}>
          <Logo />
        </div>
        <h1>Bienvenido a EliteFitness</h1>
        <p className="muted" style={{ fontSize: 14 }}>
          Tu cuenta de coach: 3 meses gratis, con hasta 5 alumnos.
        </p>
        <form onSubmit={continuar}>
          <div className="field">
            <label htmlFor="nombre">¿Cómo te llamas?</label>
            <input id="nombre" className="input" value={nombre} onChange={(e) => setNombre(e.target.value)}
              placeholder="Camila Rojas" autoComplete="name" maxLength={60} autoFocus />
            <small className="muted" style={{ fontSize: 12 }}>Lo ven tus alumnos y quienes visitan tu perfil.</small>
          </div>
          {error && <div className="form-error">{error}</div>}
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} disabled={cargando}>
            {cargando ? 'GUARDANDO…' : 'CONTINUAR'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 18, fontSize: 13, lineHeight: 1.6 }}>
          ¿Querías entrenar, no guiar a otros? La cuenta de alumno se completa en la app EliteFitness.
        </p>
        <form action={signOut}>
          <button type="submit" className="muted" style={{ background: 'none', border: 'none', padding: 0, marginTop: 8, fontSize: 13, textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}>
            Salir
          </button>
        </form>
      </div>
    </div>
  );
}
