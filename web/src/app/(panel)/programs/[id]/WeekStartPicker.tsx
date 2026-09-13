'use client';

import { useState } from 'react';
import { claveDia } from '@/lib/semanaUTC';

// Calendario de rango POR DÍA, a la Google Flights: el primer clic marca el
// DÍA de inicio del programa, el segundo el DÍA de término; un clic anterior
// al inicio (o con el rango cerrado) reinicia. Se pinta exactamente de día a
// día. Los días pasados quedan deshabilitados.

export interface RangoDias {
  /** 'YYYY-MM-DD' local */
  inicio: string;
  fin: string | null;
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export default function WeekStartPicker({ value, onChange }: {
  value: RangoDias;
  onChange: (rango: RangoDias) => void;
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
    if (value.fin != null || key <= value.inicio) onChange({ inicio: key, fin: null });
    else onChange({ inicio: value.inicio, fin: key });
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
            return (
              <button
                key={i}
                type="button"
                disabled={pasado}
                onClick={() => elegir(key)}
                title={pasado
                  ? 'Día ya pasado'
                  : value.fin == null && key > value.inicio
                    ? 'Terminar el programa este día'
                    : 'Comenzar el programa este día'}
                style={{
                  fontSize: 12, textAlign: 'center', padding: '6px 0',
                  fontFamily: 'var(--font-mono), monospace',
                  background: enRango ? 'var(--accent)' : 'transparent',
                  border: 'none',
                  opacity: pasado ? 0.3 : enRango && !esBorde ? 0.85 : 1,
                  outline: esBorde ? '2px solid var(--accent-dark)' : 'none',
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
