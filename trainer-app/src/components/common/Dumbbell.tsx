import React from 'react';
import Svg, { G, Rect } from 'react-native-svg';
import { colors } from '../../theme';

// La mancuerna de la marca — el mismo trazo del ícono de la app y del logo
// de la web, como componente para usar dentro de la app (tarjeta de
// compartir, y donde la marca necesite firmar).
export default function Dumbbell({ size = 24, color = colors.accent }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <G fill={color} rotation={45} originX={32} originY={32}>
        <Rect x={14} y={29.4} width={36} height={5.2} rx={2.6} />
        <Rect x={17.8} y={19.8} width={6.6} height={24.4} rx={3.3} />
        <Rect x={39.6} y={19.8} width={6.6} height={24.4} rx={3.3} />
        <Rect x={12.4} y={23.3} width={5.4} height={17.4} rx={2.7} />
        <Rect x={46.2} y={23.3} width={5.4} height={17.4} rx={2.7} />
      </G>
    </Svg>
  );
}
