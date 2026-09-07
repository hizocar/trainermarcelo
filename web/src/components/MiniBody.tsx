import parts from '@/lib/bodyParts.json';

// Mini mapa muscular para las tarjetas del tablero: el cuerpo anatómico de la
// app (react-native-body-highlighter, MIT — trazados extraídos a JSON) con el
// músculo del ejercicio encendido. Es nuestra respuesta a las fotos de stock:
// cero fotos, cien por ciento datos, y monocromo como todo lo demás.
//
// Espejo de SLUG_POR_GRUPO (trainer-app/src/lib/muscles.ts) y de la
// heurística de lado de ShareSessionCard: los grupos posteriores giran el
// cuerpo. El viewBox de la librería: frontal "0 0 724 1448", posterior
// "724 0 724 1448".

const SLUGS: Record<string, string> = {
  'Pecho': 'chest',
  'Espalda alta': 'upper-back',
  'Espalda baja': 'lower-back',
  'Hombro anterior': 'deltoids',
  'Hombro medial': 'deltoids',
  'Hombro posterior': 'deltoids',
  'Bíceps': 'biceps',
  'Tríceps': 'triceps',
  'Antebrazos': 'forearm',
  'Cuádriceps': 'quadriceps',
  'Isquiotibiales': 'hamstring',
  'Aductor': 'adductors',
  'Glúteo mayor': 'gluteal',
  'Glúteo medio': 'gluteal',
  'Glúteo menor': 'gluteal',
  'Gastrocnemios': 'calves',
  'Core': 'abs',
};

const POSTERIORES = new Set([
  'Espalda alta', 'Espalda baja', 'Hombro posterior', 'Tríceps',
  'Isquiotibiales', 'Glúteo mayor', 'Glúteo medio', 'Glúteo menor', 'Gastrocnemios',
]);

export default function MiniBody({ grupo, height = 64 }: { grupo: string; height?: number }) {
  const g = (grupo ?? '').trim();
  const slug = SLUGS[g] ?? null;
  const atras = POSTERIORES.has(g);
  const lista = (atras ? parts.back : parts.front) as { slug: string; paths: string[] }[];
  return (
    <svg
      viewBox={atras ? '724 0 724 1448' : '0 0 724 1448'}
      width={height / 2}
      height={height}
      aria-hidden
      style={{ flexShrink: 0, display: 'block' }}
    >
      {lista.map((p) =>
        p.paths.map((d, i) => (
          <path
            key={`${p.slug}-${i}`}
            d={d}
            fill={slug && p.slug === slug ? 'var(--accent)' : 'var(--body-dim, rgba(255,255,255,0.09))'}
          />
        )),
      )}
    </svg>
  );
}
