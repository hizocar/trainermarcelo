import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../../theme';
import { MoodFaceLevel } from '../../lib/mood';

interface Props {
  level: MoodFaceLevel;
  size?: number;
  active?: boolean;
}

// Trazos de Lucide (https://lucide.dev), licencia ISC,
// Copyright (c) 2026 Lucide Icons and Contributors.
// Se incrustan en vez de depender del paquete: son cinco iconos y la librería
// trae ~1500. Dibujar caras a mano se ve amateur; estas vienen de diseñadores,
// con el mismo círculo y el mismo grosor de trazo entre las cinco.
//
// Nada de emojis: la app es monocroma por decisión (ver src/theme/index.ts) y
// el ámbar está reservado para "el coach tiene que hacer algo". La gradación
// va por brillo, no por tono.
const FACE_PATHS: Record<MoodFaceLevel, string[]> = {
  // face-angry: cejas caídas y boca hacia abajo
  1: [
    'M15 11V9.416',
    'M17 9a5 5 0 00-3 1',
    'M7 9a5 5 0 013 1',
    'M9 11V9.416',
    'M9 16a5 5 0 016.001 0',
  ],
  // face-slightly-frowning
  2: [
    'M15 10V9',
    'M9 10V9',
    'M9 16a5 5 0 016 0',
  ],
  // face-neutral: boca recta, el "ni bien ni mal"
  3: [
    'M15 10V9',
    'M8 16h8',
    'M9 10V9',
  ],
  // face-slightly-smiling
  4: [
    'M15 10V9',
    'M16.472 15a6 6 0 01-8.943 0',
    'M9 10V9',
  ],
  // face-grinning: boca abierta
  5: [
    'M15 10V9',
    'M7.084 14.302a5.12 5.12 0 009.833 0 .24.24 0 00-.235-.302H7.32a.24.24 0 00-.235.302',
    'M9 10V9',
  ],
};

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

export default function MoodFace({ level, size = 40, active = false }: Props) {
  // seleccionado: el mismo tratamiento del resto de la app — fondo accent y
  // el trazo en el color del fondo
  const stroke = active ? colors.background : STROKES[level];

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Circle cx={12} cy={12} r={10} fill={active ? colors.accent : 'none'} />
      {FACE_PATHS[level].map(d => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  );
}
