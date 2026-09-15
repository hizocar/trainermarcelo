'use client';

import { useState } from 'react';
import { claveDia, sumarDias } from '@/lib/semanaUTC';

// Calendario de rango POR DÍA, a la Google Flights: el primer clic marca el
// DÍA de inicio del programa y el término queda SUGERIDO según cuántas
// semanas dura (inicio + semanas·7 − 1, borde punteado). Un clic posterior
// fija el término a mano; un clic anterior al inicio (o con un término
// manual ya fijado) reinicia el rango. Los días pasados quedan deshabilitados.

export interface RangoDias {
  /** 'YYYY-MM-DD' local */
  inicio: string;
  fin: string | null;
  /** true si `fin` lo propuso el sistema por la duración del programa */
  finSugerido?: boolean;
}

/** El término que sugiere la duración: inicio + semanas·7 − 1 días. */
export function finSugeridoPara(inicio: string, semanas: number): string | null {
  return semanas >= 1 ? sumarDias(inicio, semanas * 7 - 1) : null;
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export default function WeekStartPicker({ value, onChange, semanas = 0 }: {
  value: RangoDias;
  onChange: (rango: RangoDias) => void;
  /** semanas del programa: alimenta el término sugerido (0 = sin sugerencia) */
  semanas?: number;
}) {
  const hoy = new Date();
  const hoyKey = claveDia(hoy);
  const inicioSel = new Date(`${value.inicio}T00:00:00`);
  const [mes, setMes] = useState(() => new Date(inicioSel.getFullYear(), inicioSel.getMonth(), 1));

  const primero = new Date(mes.getFullYear(), mes.getMonth(), 1);
  const corrimiento = (primero.getDay() + 6) % 7;
  const inicioGrilla = new Date(primero);
  inicioGrilla.setDate(primero.getDate() - corrimiento);

  const filas = Array.from({ length: 6 }, (_, r) => {
    const lunes = new Date(inicioGrilla);
    lunes.setDate(inicioGrilla.getDate() + r * 7);
    return lunes;
  });

  function cambiarMes(delta: number) {
    setMes((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  function elegir(key: string) {
    const finManual = value.fin != null && !value.finSugerido;
    if (key <= value.inicio || finManual) {
      // nuevo inicio: el término vuelve a ser la sugerencia del programa
      const fin = finSugeridoPara(key, semanas);
      onChange({ inicio: key, fin, finSugerido: fin != null });
    } else {
      // clic posterior con término sugerido (o sin término): lo fija a mano
      onChange({ inicio: value.inicio, fin: key, finSugerido: false });
    }
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <button type="button" className="icon-btn" onClick={() => cambiarMes(-1)} aria-label="Mes anterior">‹</button>
        <strong style={{ fontSize: 13, letterSpacing: 1 }}>
          {MESES[mes.getMonth()].toUpperCase()} {mes.getFullYear()}
        </strong>
        <button type="button" className="icon-btn" onClick={() => cambiarMes(1)} aria-label="Mes siguiente">›</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {DIAS.map((d, i) => (
          <span key={i} className="label muted" style={{ fontSize: 9, textAlign: 'center', letterSpacing: 1 }}>{d}</span>
        ))}
      </div>

      {filas.map((lunes) => (
        <div key={lunes.toISOString()} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0, marginBottom: 2 }}>
          {Array.from({ length: 7 }, (_, i) => {
            const dia = new Date(lunes);
            dia.setDate(lunes.getDate() + i);
            const key = claveDia(dia);
            const delMes = dia.getMonth() === mes.getMonth();
            const esHoy = key === hoyKey;
            const pasado = key < hoyKey;
            const enRango = key >= value.inicio && key <= (value.fin ?? value.inicio);
            const esBorde = key === value.inicio || key === value.fin;
            const esFinSugerido = value.finSugerido === true && key === value.fin;
            return (
              <button
                key={i}
                type="button"
                disabled={pasado}
                onClick={() => elegir(key)}
                title={pasado
                  ? 'Día ya pasado'
                  : esFinSugerido
                    ? 'Término sugerido por la duración del programa — clic en otro día posterior para cambiarlo'
                    : (value.fin == null || value.finSugerido) && key > value.inicio
                      ? 'Terminar el programa este día'
                      : 'Comenzar el programa este día'}
                style={{
                  fontSize: 12, textAlign: 'center', padding: '6px 0',
                  fontFamily: 'var(--font-mono), monospace',
                  background: enRango ? 'var(--accent)' : 'transparent',
                  border: 'none',
                  opacity: pasado ? 0.3 : enRango && !esBorde ? 0.85 : 1,
                  outline: esBorde
                    ? `2px ${esFinSugerido ? 'dashed' : 'solid'} var(--accent-dark)`
                    : 'none',
                  outlineOffset: -2,
                  borderRadius: enRango
                    ? `${key === value.inicio ? '6px' : '0'} ${key === (value.fin ?? value.inicio) ? '6px' : '0'} ${key === (value.fin ?? value.inicio) ? '6px' : '0'} ${key === value.inicio ? '6px' : '0'}`
                    : 6,
                  color: enRango ? 'var(--on-accent)' : delMes ? 'var(--text)' : 'var(--text-muted)',
                  fontWeight: esHoy ? 800 : 400,
                  textDecoration: esHoy ? 'underline' : 'none',
                  cursor: pasado ? 'not-allowed' : 'pointer',
                }}
              >
                {dia.getDate()}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
