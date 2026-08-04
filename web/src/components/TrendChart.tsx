// Gráfico de línea liviano en SVG puro — viewBox fijo, escala por CSS (sin JS).
// Espejo conceptual del TrendChart de la app.

interface Point {
  label: string;
  value: number;
}

export default function TrendChart({ data, height = 200, unit = '' }: { data: Point[]; height?: number; unit?: string }) {
  if (data.length === 0) return null;

  const width = 700;
  const padTop = 24;
  const padBottom = 30;
  const padX = 20;
  const chartH = height - padTop - padBottom;
  const chartW = width - padX * 2;

  const values = data.map((d) => d.value);
  const max = Math.max(...values, 1);
  const min = 0; // arranca en 0: evita que valores altos parezcan "cero"
  const range = max - min || 1;

  const x = (i: number) => padX + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW);
  const y = (v: number) => padTop + chartH - ((v - min) / range) * chartH;

  const points = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  const areaPoints = `${points} ${x(data.length - 1)},${padTop + chartH} ${x(0)},${padTop + chartH}`;
  const last = data[data.length - 1];

  return (
    <div style={{ width: '100%' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={padX} x2={padX + chartW}
            y1={padTop + chartH * f} y2={padTop + chartH * f}
            stroke="var(--border)" strokeWidth={1} strokeDasharray="3 5"
          />
        ))}
        <polygon points={areaPoints} fill="var(--accent)" opacity={0.08} />
        <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinejoin="round" />
        {data.map((d, i) => (
          <circle
            key={i}
            cx={x(i)} cy={y(d.value)}
            r={i === data.length - 1 ? 5 : 3}
            fill={i === data.length - 1 ? 'var(--accent)' : 'var(--bg)'}
            stroke="var(--accent)" strokeWidth={2}
          />
        ))}
        <text
          x={x(data.length - 1)} y={y(last.value) - 14}
          textAnchor="end" fontFamily="var(--font-mono)" fontSize="13" fontWeight={600}
          fill="var(--accent)"
        >
          {last.value.toLocaleString('es-CL')}{unit}
        </text>
        {data.map((d, i) => (
          <text
            key={i}
            x={x(i)} y={height - 8}
            textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10"
            fill="var(--text-muted)"
          >
            {d.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
