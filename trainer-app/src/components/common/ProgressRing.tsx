import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedProps, useAnimatedStyle, withDelay, withTiming,
  useReducedMotion, Easing,
} from 'react-native-reanimated';
import { colors, fonts } from '../../theme';
import { DURATION, DELAY, RING_BEZIER } from '../../lib/motion';

// cubic-bezier(.22, 1, .36, 1) — la desaceleración que especifica el diseño
const RING_EASING = Easing.bezier(...RING_BEZIER);

// bajo este diámetro la pista en colors.surface se pierde contra el fondo
// (#00030D): el grosor del trazo es tan fino que ya no hay contraste
// perceptible entre "pista vacía" y "nada dibujado"
const SMALL_RING_THRESHOLD = 100;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  /** unidades completadas (ejercicios del día, o series de un ejercicio) */
  done: number;
  /** total de unidades (ejercicios del día, o series de un ejercicio) */
  total: number;
  /** diámetro en px */
  size?: number;
  /** texto bajo el número, en mayúsculas. Vacío = sin etiqueta */
  label?: string;
  /** al completarse, mostrar un check en vez de "3/3" */
  tickWhenComplete?: boolean;
}

/**
 * Anillo de progreso. Es el dato héroe de la pantalla "Hoy" (ejercicios del
 * día) y también el indicador de cada fila de ejercicio (series registradas).
 *
 * Es monocromo a propósito. En apps como Whoop el anillo comunica con color
 * (verde/ámbar/rojo); acá el sistema es monocromo y el único color está
 * reservado para las alertas del coach, así que el anillo comunica solo por
 * cuánto se llena — y el número del centro dice explícitamente lo que el
 * color diría.
 */
export default function ProgressRing({
  done, total, size = 132, label = 'EJERCICIOS', tickWhenComplete = false,
}: Props) {
  const reduced = useReducedMotion();

  // el grosor acompaña al diámetro: 9px en el anillo héroe de 132, y algo
  // proporcionalmente fino en los anillos chicos de cada ejercicio
  const STROKE = Math.max(3, Math.round(size * 0.068));
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = total > 0 ? Math.min(done / total, 1) : 0;
  // la pista de colors.surface es invisible en los anillos chicos de cada
  // fila: ahí usamos un gris más claro sin tocar el anillo héroe
  const trackColor = size < SMALL_RING_THRESHOLD ? colors.border : colors.surface;

  // 0 = vacío, 1 = lleno
  const progress = useSharedValue(reduced ? ratio : 0);
  const valueOpacity = useSharedValue(reduced ? 1 : 0);

  React.useEffect(() => {
    if (reduced) {
      progress.value = ratio;
      valueOpacity.value = 1;
      return;
    }
    progress.value = withTiming(ratio, { duration: DURATION.ring, easing: RING_EASING });
    valueOpacity.value = withDelay(DELAY.value, withTiming(1, { duration: DURATION.value }));
  }, [ratio, reduced]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const valueStyle = useAnimatedStyle(() => ({ opacity: valueOpacity.value }));

  return (
    <View style={styles.wrap}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={trackColor} strokeWidth={STROKE} fill="none"
        />
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={colors.accent} strokeWidth={STROKE} fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          // el anillo arranca arriba, no a la derecha
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        {tickWhenComplete && total > 0 && done >= total ? (
          // completo: un visto vale más que "3/3". Anton no tiene el glifo
          // ✓ en su cmap (cae en cascada a otra fuente, con métrica ajena,
          // o directo a un cuadrado en Android) — se usa un ícono en vez de texto.
          <Animated.View style={valueStyle}>
            <Ionicons name="checkmark" size={Math.round(size * 0.34)} color={colors.textPrimary} />
          </Animated.View>
        ) : (
          <Animated.Text style={[styles.value, { fontSize: Math.round(size * 0.24) }, valueStyle]}>
            {done}/{total}
          </Animated.Text>
        )}
        {label ? <Text style={styles.label}>{label}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', justifyContent: 'center', alignItems: 'center' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  // sin fontSize acá: siempre se sobrescribe con el tamaño calculado a partir del diámetro
  value: { fontFamily: fonts.display, color: colors.textPrimary, letterSpacing: 0.5 },
  label: { fontSize: 8, fontWeight: '800', letterSpacing: 2, color: colors.textMuted, marginTop: -2 },
});
