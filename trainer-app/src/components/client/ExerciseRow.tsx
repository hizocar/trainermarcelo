import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withDelay, withTiming, withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import { PlanExercise } from '../../lib/plan';
import ProgressRing from '../common/ProgressRing';
import { colors, spacing } from '../../theme';
import { DURATION, rowDelay, EASING_OUT } from '../../lib/motion';

interface Props {
  exercise: PlanExercise;
  /** todas sus series registradas */
  done: boolean;
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
 * Dos estados, no tres: ya no existe el "SIGUIENTE" en blanco puro. Todos los
 * nombres pesan igual y cuál toca lo dice el anillo de series de la derecha —
 * resaltar una fila competía con esa señal:
 *   hecho     → atenuado al 45%, con las series registradas en el anillo
 *   pendiente → a brillo pleno
 */
export default function ExerciseRow({ exercise, done, index, seriesDone, onPress }: Props) {
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

  const isDone = done;

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
          {/* Solo el nombre, en mayúsculas y todos con el mismo peso. El
              conteo de series lo dice el anillo de la derecha, que también
              deja ver cuál toca: resaltar uno solo competía con esa señal. */}
          <Text style={styles.name} numberOfLines={2}>
            {exercise.name.toUpperCase()}
          </Text>
        </View>
        <ProgressRing
          done={seriesDone}
          total={series}
          size={48}
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
  name: { fontSize: 15, fontWeight: '800', letterSpacing: 0.5, color: colors.textPrimary },
});
