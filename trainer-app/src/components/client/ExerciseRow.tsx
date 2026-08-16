import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withDelay, withTiming, withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import { PlanExercise } from '../../lib/plan';
import { colors, spacing, fonts } from '../../theme';
import { DURATION, rowDelay, EASING_OUT } from '../../lib/motion';

export type RowState = 'done' | 'next' | 'pending';

interface Props {
  exercise: PlanExercise;
  state: RowState;
  /** posición en la lista, para escalonar la entrada */
  index: number;
  /** su MEJOR serie registrada en este ejercicio, si ya lo hizo */
  topSet?: { weight: number; reps: number };
  onPress: () => void;
}

/**
 * Una fila de ejercicio. Deja de ser una tarjeta con borde y miniatura: menos
 * cajas y menos bordes es lo que hace que una pantalla densa se lea cara en
 * vez de recargada.
 *
 * Tres estados con peso visual muy distinto — que todo pesara lo mismo era
 * exactamente el problema del diseño anterior:
 *   done    → atenuado, muestra lo que levantó
 *   next    → blanco puro, más grande, etiquetado SIGUIENTE
 *   pending → gris medio
 */
export default function ExerciseRow({ exercise, state, index, topSet, onPress }: Props) {
  const reduced = useReducedMotion();

  const opacity = useSharedValue(reduced ? 1 : 0);
  const translateY = useSharedValue(reduced ? 0 : 10);

  React.useEffect(() => {
    if (reduced) {
      opacity.value = 1;
      translateY.value = 0;
      return;
    }
    const delay = rowDelay(index);
    opacity.value = withDelay(delay, withTiming(1, { duration: DURATION.row }));
    translateY.value = withDelay(delay, withSpring(0, EASING_OUT));
  }, [index, reduced]);

  const isDone = state === 'done';
  const isNext = state === 'next';

  // El atenuado de "hecho" va DENTRO del estilo animado a propósito: al aplanar
  // [styles.rowDone, animStyle] ganaba el último, y animStyle termina con
  // opacity 1 — los ejercicios completados se veían igual que los pendientes.
  // `isDone` se captura en el closure del worklet, por eso se declara arriba.
  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * (isDone ? 0.45 : 1),
    transform: [{ translateY: translateY.value }],
  }), [isDone]);

  const series = exercise.exercise_series.length;
  const meta = isDone
    ? `HECHO · ${series} SERIES`
    : isNext
      ? `SIGUIENTE · ${series} SERIES · ${exercise.reps_objective}`
      : `${series} SERIES · ${exercise.reps_objective}`;

  // hecho: su mejor serie de verdad. Si no, el peso de referencia del coach.
  const valueText = isDone && topSet
    ? `${topSet.weight}×${topSet.reps}`
    : exercise.ref_weight != null
      ? `${exercise.ref_weight}`
      : '—';

  return (
    <Animated.View style={[styles.row, animStyle]}>
      <TouchableOpacity style={styles.touch} onPress={onPress} activeOpacity={0.6}>
        <View style={styles.info}>
          {/* dos líneas: con la columna de valor en mono 21px, un nombre real
              como "Prensa inclinada 45° a una pierna" no cabe en una sola */}
          <Text style={[styles.name, isNext && styles.nameNext]} numberOfLines={2}>
            {exercise.name}
          </Text>
          <Text style={[styles.meta, isNext && styles.metaNext]}>{meta}</Text>
        </View>
        <Text style={[styles.value, isNext && styles.valueNext, isDone && styles.valueDone]}>
          {valueText}
          {!isDone && exercise.ref_weight != null && (
            <Text style={styles.unit}>{exercise.unit}</Text>
          )}
        </Text>
        {isDone && <Text style={styles.check}>✓</Text>}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { borderTopWidth: 1, borderTopColor: colors.border },
  touch: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md - 4 },
  info: { flex: 1 },
  name: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  nameNext: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  meta: { fontSize: 9, letterSpacing: 1, color: colors.textMuted, marginTop: 2 },
  metaNext: { color: colors.textPrimary },
  value: { fontFamily: fonts.mono, fontSize: 18, color: colors.textMuted },
  valueNext: { fontSize: 21, color: colors.textPrimary },
  valueDone: { fontSize: 16, color: colors.textMuted },
  unit: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted },
  check: { fontSize: 13, color: colors.textMuted },
});
