'use client';

import { useState } from 'react';
import { santiagoCurrentWeek, weekNumberForDate, weekStartDate } from '@/lib/weeks';

// Calendario para elegir la SEMANA en que comienza el programa (las semanas
// del programa corren de lunes a domingo, como todo el sistema). Se navega
// por mes real del año; se elige una fila completa. Las semanas ya pasadas
// quedan deshabilitadas — un programa no puede comenzar en el pasado.

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export default function WeekStartPicker({ value, onChange }: { value: number; onChange: (week: number) => void }) {
  const semanaActual = santiagoCurrentWeek();
  const inicioSel = weekStartDate(value);
  const [mes, setMes] = useState(() => new Date(inicioSel.getFullYear(), inicioSel.getMonth(), 1));

  const hoy = new Date();
  const hoyKey = `${hoy.getFullYear()}-${hoy.getMonth()}-${hoy.getDate()}`;

  // primer lunes de la grilla (la semana que contiene el día 1 del mes)
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

      {filas.map((lunes) => {
        const numSemana = weekNumberForDate(lunes);
        const pasada = numSemana < semanaActual;
        const elegida = numSemana === value;
        return (
          <button
            key={lunes.toISOString()}
            type="button"
            disabled={pasada}
            onClick={() => onChange(numSemana)}
            title={pasada ? 'Semana ya pasada' : `Comenzar la semana del lunes ${lunes.getDate()} de ${MESES[lunes.getMonth()].toLowerCase()}`}
            style={{
              display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, width: '100%',
              background: elegida ? 'var(--accent)' : 'transparent',
              border: '1px solid ' + (elegida ? 'var(--accent)' : 'transparent'),
              borderRadius: 8, padding: '2px 0', marginBottom: 2,
              cursor: pasada ? 'not-allowed' : 'pointer',
              opacity: pasada ? 0.35 : 1,
            }}
          >
            {Array.from({ length: 7 }, (_, i) => {
              const dia = new Date(lunes);
              dia.setDate(lunes.getDate() + i);
              const delMes = dia.getMonth() === mes.getMonth();
              const esHoy = `${dia.getFullYear()}-${dia.getMonth()}-${dia.getDate()}` === hoyKey;
              return (
                <span
                  key={i}
                  style={{
                    fontSize: 12, textAlign: 'center', padding: '4px 0',
                    fontFamily: 'var(--font-mono), monospace',
                    color: elegida ? 'var(--on-accent)' : delMes ? 'var(--text)' : 'var(--text-muted)',
                    fontWeight: esHoy ? 800 : 400,
                    textDecoration: esHoy ? 'underline' : 'none',
                  }}
                >
                  {dia.getDate()}
                </span>
              );
            })}
          </button>
        );
      })}
    </div>
  );
}
