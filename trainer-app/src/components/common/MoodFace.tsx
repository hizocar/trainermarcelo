import React from 'react';
import Svg, { Circle, Path, Line } from 'react-native-svg';
import { colors } from '../../theme';
import { MoodFaceLevel } from '../../lib/mood';

interface Props {
  level: MoodFaceLevel;
  size?: number;
  active?: boolean;
}

// Nada de emojis: la app es monocroma por decisión (ver src/theme/index.ts) y
// el ámbar está reservado para "el coach tiene que hacer algo". Las caras se
// dibujan en SVG para poder graduarlas por brillo, no por tono.
//
// Rampa de brillo: la cara más cansada queda apagada (textMuted) y la más
// enérgica llega al gris claro del sistema (accent). Los dos grises del medio
// no existen en el tema porque solo tienen sentido como pasos de esta rampa.
const STROKES: Record<MoodFaceLevel, string> = {
  1: colors.textMuted,      // #626B73
  2: '#7A828A',
  3: colors.textSecondary,  // #949DA6
  4: '#B6BCC0',
  5: colors.accent,         // #D8D9D7
};

// Punto de control de la curva de la boca (la boca va de 14,31 a 34,31).
// Menos que 31 = comisuras hacia abajo (agotado); más = sonrisa. El nivel 3
// es una recta a propósito: es el "ni bien ni mal" y tiene que leerse plano.
const MOUTH_CONTROL: Record<MoodFaceLevel, number | null> = {
  1: 20,
  2: 26.5,
  3: null,
  4: 37.5,
  5: 43,
};

// Radio del ojo: más cerrado abajo, más abierto arriba. El nivel 1 no usa
// radio, va con los ojos cerrados (dos líneas).
const EYE_RADIUS: Record<MoodFaceLevel, number> = {
  1: 0,
  2: 1.6,
  3: 2.1,
  4: 2.6,
  5: 3.1,
};

export default function MoodFace({ level, size = 40, active = false }: Props) {
  const stroke = active ? colors.background : STROKES[level];
  const fill = active ? colors.accent : 'none';
  const control = MOUTH_CONTROL[level];
  const eyeR = EYE_RADIUS[level];

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Circle cx={24} cy={24} r={21} fill={fill} stroke={stroke} strokeWidth={2} />

      {level === 1 ? (
        // ojos cerrados: agotado
        <>
          <Line x1={12.5} y1={19} x2={19.5} y2={19} stroke={stroke} strokeWidth={2} strokeLinecap="round" />
          <Line x1={28.5} y1={19} x2={35.5} y2={19} stroke={stroke} strokeWidth={2} strokeLinecap="round" />
        </>
      ) : (
        <>
          <Circle cx={16} cy={19} r={eyeR} fill={stroke} />
          <Circle cx={32} cy={19} r={eyeR} fill={stroke} />
        </>
      )}

      <Path
        d={control == null ? 'M14 31 L34 31' : `M14 31 Q24 ${control} 34 31`}
        fill="none"
        stroke={stroke}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
    </Svg>
  );
}
