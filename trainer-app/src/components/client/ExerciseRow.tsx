import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withDelay, withTiming, withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import { PlanExercise } from '../../lib/plan';
import ProgressRing from '../common/ProgressRing';
import { colors, spacing, fonts } from '../../theme';
import { DURATION, rowDelay, EASING_OUT } from '../../lib/motion';

export type RowState = 'done' | 'next' | 'pending';

interface Props {
  exercise: PlanExercise;
  state: RowState;
  /** posición en la lista, para escalonar la entrada */
  index: number;
  /** series ya registradas de este ejercicio */
  seriesDone: number;
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
export default function ExerciseRow({ exercise, state, index, seriesDone, onPress }: Props) {
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

  return (
    <Animated.View style={[styles.row, animStyle]}>
      <TouchableOpacity style={styles.touch} onPress={onPress} activeOpacity={0.6}>
        <View style={styles.info}>
          {/* solo el nombre: el conteo de series lo dice el anillo, y repetirlo
              en texto era justo el ruido que este rediseño vino a sacar */}
          <Text style={[styles.name, isNext && styles.nameNext]} numberOfLines={2}>
            {exercise.name}
          </Text>
        </View>
        <ProgressRing
          done={seriesDone}
          total={series}
          size={38}
          label=""
          tickWhenComplete
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { borderTopWidth: 1, borderTopColor: colors.border },
  touch: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md - 4 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  nameNext: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
});
