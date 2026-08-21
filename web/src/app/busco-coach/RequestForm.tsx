'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { normalizeWhatsapp } from '@/lib/marketplace';

const MODALIDADES = [
  { value: 'presencial', label: 'Presencial' },
  { value: 'online', label: 'Online' },
  { value: 'ambas', label: 'Me da igual' },
] as const;

export default function RequestForm() {
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [comuna, setComuna] = useState('');
  const [modality, setModality] = useState<string>('ambas');
  const [goal, setGoal] = useState('');
  const [availability, setAvailability] = useState('');
  const [trap, setTrap] = useState('');           // honeypot
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const phone = normalizeWhatsapp(whatsapp);
    if (!phone) { setError('Ese número no parece un móvil chileno. Ejemplo: 9 1234 5678.'); return; }
    if (name.trim().length < 2) { setError('Escribe tu nombre.'); return; }
    if (comuna.trim().length < 2) { setError('Escribe tu comuna.'); return; }
    if (goal.trim().length < 10) { setError('Cuéntanos un poco más de lo que buscas.'); return; }

    setLoading(true);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc('create_request', {
      p_name: name.trim(),
      p_whatsapp: phone,
      p_comuna: comuna.trim(),
      p_modality: modality,
      p_goal: goal.trim(),
      p_availability: availability.trim(),
      p_trap: trap,
    });

    if (rpcError) {
      // El mensaje de Postgres no se muestra crudo: dice más de lo que el
      // visitante necesita y en el caso del honeypot delata la trampa.
      setError(
        rpcError.message.includes('ya tienes una solicitud abierta')
          ? 'Ya tienes una solicitud abierta. Espera a que te escriban.'
          : 'No se pudo enviar. Revisa los datos e inténtalo de nuevo.',
      );
      setLoading(false);
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <div className="auth-card" style={{ maxWidth: 460 }}>
        <h1>Listo</h1>
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
          En las próximas horas te va a escribir un entrenador por WhatsApp. Puede
          escribirte más de uno: responde al que más te acomode.
        </p>
      </div>
    );
  }

  return (
    <form className="auth-card" style={{ maxWidth: 460 }} onSubmit={handleSubmit}>
      <h1>Busco entrenador</h1>
      <p className="muted" style={{ fontSize: 14 }}>
        Cuéntanos qué buscas y te escriben por WhatsApp. No tienes que crear cuenta.
      </p>

      <div className="field">
        <label>Nombre</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
      </div>

      <div className="field">
        <label>WhatsApp</label>
        <input className="input" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
               inputMode="tel" placeholder="9 1234 5678" required />
      </div>

      <div className="field">
        <label>Comuna</label>
        <input className="input" value={comuna} onChange={(e) => setComuna(e.target.value)} maxLength={60} required />
      </div>

      <div className="field">
        <label>¿Presencial u online?</label>
        <select className="input" value={modality} onChange={(e) => setModality(e.target.value)}>
          {MODALIDADES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      <div className="field">
        <label>¿Qué buscas?</label>
        <textarea className="input" value={goal} onChange={(e) => setGoal(e.target.value)}
                  rows={4} maxLength={600} required
                  placeholder="Bajar de peso, ganar masa, volver a entrenar después de una lesión…" />
      </div>

      <div className="field">
        <label>¿Cuándo puedes entrenar? (opcional)</label>
        <input className="input" value={availability} onChange={(e) => setAvailability(e.target.value)}
               maxLength={300} placeholder="Mañanas, o martes y jueves" />
      </div>

      {/* Honeypot: fuera de pantalla y fuera del recorrido del teclado. Un
          humano no lo ve; un bot que rellena todo lo llena y queda rechazado.
          name="xfield" es deliberadamente sin significado para que los gestores
          de contraseñas no lo reconozcan; no cambiar a un nombre "real". */}
      <input value={trap} onChange={(e) => setTrap(e.target.value)}
             name="xfield" tabIndex={-1} autoComplete="off" aria-hidden="true"
             style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} />

      {error && <div className="form-error">{error}</div>}

      <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 24 }}>
        {loading ? 'ENVIANDO…' : 'PUBLICAR MI SOLICITUD'}
      </button>
    </form>
  );
}
