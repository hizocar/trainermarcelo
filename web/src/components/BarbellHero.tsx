import { CounterReadout } from './CounterReadout';

/**
 * Firma visual de la landing: una barra que se carga de discos (misma gramática
 * del logo de mancuerna) y aterriza en la carga total real de una semana —
 * el dato que el histórico de la app muestra por ejercicio.
 */
export default function BarbellHero() {
  return (
    <div className="barbell-hero">
      <svg className="barbell-svg" viewBox="0 0 640 200" aria-hidden="true">
        <rect className="bb-bar" x="140" y="93" width="360" height="14" rx="6" />
        <rect className="bb-collar bb-collar-l" x="120" y="80" width="24" height="40" rx="4" />
        <rect className="bb-collar bb-collar-r" x="496" y="80" width="24" height="40" rx="4" />

        <g className="bb-plate bb-plate-l bb-p1"><rect x="94" y="30" width="22" height="140" rx="6" /></g>
        <g className="bb-plate bb-plate-l bb-p2"><rect x="68" y="48" width="18" height="104" rx="6" /></g>
        <g className="bb-plate bb-plate-l bb-p3"><rect x="44" y="64" width="14" height="72" rx="6" /></g>

        <g className="bb-plate bb-plate-r bb-p1"><rect x="524" y="30" width="22" height="140" rx="6" /></g>
        <g className="bb-plate bb-plate-r bb-p2"><rect x="554" y="48" width="18" height="104" rx="6" /></g>
        <g className="bb-plate bb-plate-r bb-p3"><rect x="582" y="64" width="14" height="72" rx="6" /></g>
      </svg>

      <div className="bb-readout">
        <span className="bb-readout-label">Carga total · semana 4</span>
        <span className="bb-readout-value">
          <CounterReadout to={780} suffix=" kg" delay={900} />
        </span>
        <span className="bb-readout-delta">+26% vs. semana 1</span>
      </div>
    </div>
  );
}
