'use client';

import { useState } from 'react';
import { semanaActualChile, semanaDeFecha, lunesDeSemana } from '@/lib/semanaUTC';

// Calendario de RANGO para el programa, a la Google Flights: el primer clic
// marca la semana de inicio, el segundo la de término; un clic antes del
// inicio (o con el rango ya cerrado) empieza de nuevo. Sin término elegido,
// la última semana del programa se repite hacia adelante (el modo de
// siempre). Las semanas corren de lunes a domingo; las pasadas quedan
// deshabilitadas, y dentro de la semana en curso los días ya transcurridos
// no se pintan — el programa rige desde hoy.

export interface RangoSemanas {
  inicio: number;
  fin: number | null;
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export default function WeekStartPicker({ value, onChange }: {
  value: RangoSemanas;
  onChange: (rango: RangoSemanas) => void;
}) {
  const semanaActual = semanaActualChile();
  const inicioSel = lunesDeSemana(value.inicio);
  const [mes, setMes] = useState(() => new Date(inicioSel.getFullYear(), inicioSel.getMonth(), 1));

  const hoy = new Date();
  const hoyKey = `${hoy.getFullYear()}-${hoy.getMonth()}-${hoy.getDate()}`;

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

  function elegir(numSemana: number) {
    // a la Google Flights: primer clic fija el inicio; el segundo, si es
    // posterior, fija el fin; cualquier otro caso reinicia el rango ahí
    if (value.fin != null || numSemana <= value.inicio) {
      onChange({ inicio: numSemana, fin: null });
    } else {
      onChange({ inicio: value.inicio, fin: numSemana });
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

      {filas.map((lunes) => {
        const numSemana = semanaDeFecha(lunes);
        const pasada = numSemana < semanaActual;
        const enRango = numSemana >= value.inicio && numSemana <= (value.fin ?? value.inicio);
        const esBorde = numSemana === value.inicio || (value.fin != null && numSemana === value.fin);
        const dias = Array.from({ length: 7 }, (_, i) => {
          const dia = new Date(lunes);
          dia.setDate(lunes.getDate() + i);
          const esHoy = `${dia.getFullYear()}-${dia.getMonth()}-${dia.getDate()}` === hoyKey;
          const yaPaso = !pasada && dia < hoy && !esHoy;
          return { dia, esHoy, yaPaso, pintado: enRango && !yaPaso };
        });
        const primerPintado = dias.findIndex(d => d.pintado);
        return (
          <button
            key={lunes.toISOString()}
            type="button"
            disabled={pasada}
            onClick={() => elegir(numSemana)}
            title={pasada
              ? 'Semana ya pasada'
              : value.fin == null && numSemana > value.inicio
                ? 'Terminar el programa el domingo de esta semana'
                : `Comenzar la semana del lunes ${lunes.getDate()} de ${MESES[lunes.getMonth()].toLowerCase()}`}
            style={{
              display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0, width: '100%',
              background: 'transparent',
              border: '1px solid ' + (esBorde ? 'var(--accent)' : 'transparent'),
              borderRadius: 8, padding: '2px 0', marginBottom: 2,
              cursor: pasada ? 'not-allowed' : 'pointer',
              opacity: pasada ? 0.35 : 1,
            }}
          >
            {dias.map(({ dia, esHoy, yaPaso, pintado }, i) => {
              const delMes = dia.getMonth() === mes.getMonth();
              return (
                <span
                  key={i}
                  style={{
                    fontSize: 12, textAlign: 'center', padding: '4px 0',
                    fontFamily: 'var(--font-mono), monospace',
                    background: pintado ? 'var(--accent)' : 'transparent',
                    opacity: yaPaso ? 0.45 : pintado && !esBorde ? 0.8 : 1,
                    borderRadius: pintado
                      ? `${i === primerPintado ? '6px' : '0'} ${i === 6 ? '6px' : '0'} ${i === 6 ? '6px' : '0'} ${i === primerPintado ? '6px' : '0'}`
                      : 0,
                    color: pintado ? 'var(--on-accent)' : delMes ? 'var(--text)' : 'var(--text-muted)',
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
