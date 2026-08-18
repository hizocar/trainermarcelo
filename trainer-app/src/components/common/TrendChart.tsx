import React, { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Polyline, Polygon, Circle, Line } from 'react-native-svg';
import { colors, typography, fonts } from '../../theme';

interface Point {
  label: string;
  value: number;
}

interface Props {
  data: Point[];
  height?: number;
  unit?: string;
  fromZero?: boolean;   // fija el eje Y en 0 (evita que valores altos parezcan "cero")
  maxValue?: number;    // fija el techo del eje Y (ver abajo)
}

// Gráfico de línea liviano en SVG puro: funciona igual en web y nativo
// (react-native-gifted-charts se rompe en web por reanimated).
export default function TrendChart({ data, height = 180, unit = '', fromZero = false, maxValue }: Props) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (data.length === 0) return null;

  const padTop = 24;
  const padBottom = 28;
  const padX = 16;
  const chartH = height - padTop - padBottom;
  const chartW = Math.max(width - padX * 2, 1);

  const values = data.map(d => d.value);
  // Sin `maxValue` el techo es el máximo de los datos, y con UN SOLO punto ese
  // máximo ES el punto: se dibuja pegado al borde de arriba valga 2 o valga 10.
  // Para escalas acotadas (el ánimo va de 1 a 10) hay que pasar el techo real.
  // Es opcional para no cambiar los gráficos que ya existen; si algún valor
  // supera el techo declarado se usa el valor, así el dato nunca se corta.
  const max = maxValue != null ? Math.max(maxValue, ...values) : Math.max(...values);
  // con fromZero el eje arranca en 0; si no, un pelín bajo el mínimo para dar aire
  const min = fromZero ? 0 : Math.min(...values);
  const range = max - min || 1;

  const x = (i: number) => padX + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW);
  const y = (v: number) => padTop + chartH - ((v - min) / range) * chartH;

  const points = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  const areaPoints = `${points} ${x(data.length - 1)},${padTop + chartH} ${x(0)},${padTop + chartH}`;

  const last = data[data.length - 1];
  const showEvery = Math.max(1, Math.ceil(data.length / 6));

  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 && (
        <>
          <Svg width={width} height={height}>
            {[0.25, 0.5, 0.75].map(f => (
              <Line
                key={f}
                x1={padX} x2={padX + chartW}
                y1={padTop + chartH * f} y2={padTop + chartH * f}
                stroke={colors.border} strokeWidth={1} strokeDasharray="3 5"
              />
            ))}
            <Polygon points={areaPoints} fill={colors.accent} opacity={0.08} />
            <Polyline points={points} fill="none" stroke={colors.accent} strokeWidth={2.5} strokeLinejoin="round" />
            {data.map((d, i) => (
              <Circle
                key={i}
                cx={x(i)} cy={y(d.value)}
                r={i === data.length - 1 ? 5 : 3}
                fill={i === data.length - 1 ? colors.accent : colors.background}
                stroke={colors.accent} strokeWidth={2}
              />
            ))}
          </Svg>

          {/* etiqueta del último valor */}
          <Text style={[styles.lastValue, { left: Math.min(x(data.length - 1) - 30, width - 72), top: y(last.value) - 24 }]}>
            {last.value}{unit}
          </Text>

          {/* etiquetas del eje X */}
          <View style={styles.xAxis} pointerEvents="none">
            {data.map((d, i) => (
              <Text
                key={i}
                style={[styles.xLabel, { left: x(i) - 20 }]}
              >
                {i % showEvery === 0 || i === data.length - 1 ? d.label : ''}
              </Text>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  lastValue: {
    position: 'absolute',
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.accent,
    width: 72,
    textAlign: 'center',
  },
  xAxis: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 20 },
  xLabel: {
    position: 'absolute',
    width: 40,
    textAlign: 'center',
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textMuted,
  },
});
