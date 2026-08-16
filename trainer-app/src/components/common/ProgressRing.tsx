import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedProps, useAnimatedStyle, withDelay, withTiming,
  useReducedMotion, Easing,
} from 'react-native-reanimated';
import { colors, fonts } from '../../theme';
import { DURATION, DELAY, RING_BEZIER } from '../../lib/motion';

// cubic-bezier(.22, 1, .36, 1) — la desaceleración que especifica el diseño
const RING_EASING = Easing.bezier(...RING_BEZIER);

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  /** ejercicios completados */
  done: number;
  /** ejercicios del día */
  total: number;
  /** diámetro en px */
  size?: number;
  /** texto bajo el número, en mayúsculas */
  label?: string;
}

/**
 * Anillo de progreso: el dato héroe de la pantalla "Hoy".
 *
 * Es monocromo a propósito. En apps como Whoop el anillo comunica con color
 * (verde/ámbar/rojo); acá el sistema es monocromo y el único color está
 * reservado para las alertas del coach, así que el anillo comunica solo por
 * cuánto se llena — y el número del centro dice explícitamente lo que el
 * color diría.
 */
export default function ProgressRing({ done, total, size = 132, label = 'EJERCICIOS' }: Props) {
  const reduced = useReducedMotion();

  const STROKE = 9;
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = total > 0 ? Math.min(done / total, 1) : 0;

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
          stroke={colors.surface} strokeWidth={STROKE} fill="none"
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
        <Animated.Text style={[styles.value, valueStyle]}>
          {done}/{total}
        </Animated.Text>
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', justifyContent: 'center', alignItems: 'center' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  value: { fontFamily: fonts.display, fontSize: 32, color: colors.textPrimary, letterSpacing: 0.5 },
  label: { fontSize: 8, fontWeight: '800', letterSpacing: 2, color: colors.textMuted, marginTop: -2 },
});
