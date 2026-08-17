import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withDelay, withTiming, withSpring, useReducedMotion,
} from 'react-native-reanimated';
import { colors, spacing, fonts } from '../../theme';
import { DURATION, rowDelay, EASING_OUT } from '../../lib/motion';

export type DataRowState = 'done' | 'active' | 'idle';

interface Props {
  /** texto principal */
  label: string;
  /** línea secundaria, en mayúsculas */
  meta?: string;
  /** la cifra de la derecha, ya formateada */
  value: string;
  /** unidad pequeña pegada a la cifra */
  unit?: string;
  state?: DataRowState;
  /** posición en la lista, para escalonar la entrada */
  index: number;
  onPress?: () => void;
}

/**
 * Una fila de datos: el ladrillo de este lenguaje visual.
 *
 * Tres estados con peso muy distinto, igual que en "Hoy":
 *   done   → atenuado, con ✓
 *   active → blanco puro, más grande
 *   idle   → gris medio
 */
export default function DataRow({
  label, meta, value, unit, state = 'idle', index, onPress,
}: Props) {
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
  const isActive = state === 'active';

  // El atenuado va DENTRO del estilo animado: al aplanar [estático, animStyle]
  // gana el último, y animStyle termina con opacity 1. Ese error dejó las filas
  // completadas de "Hoy" sin atenuar hasta que lo cazó una revisión.
  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * (isDone ? 0.45 : 1),
    transform: [{ translateY: translateY.value }],
  }), [isDone]);

  const contenido = (
    <View style={styles.inner}>
      <View style={styles.info}>
        <Text style={[styles.label, isActive && styles.labelActive]} numberOfLines={2}>
          {label}
        </Text>
        {meta ? <Text style={[styles.meta, isActive && styles.metaActive]}>{meta}</Text> : null}
      </View>
      <Text style={[styles.value, isActive && styles.valueActive, isDone && styles.valueDone]}>
        {value}
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </Text>
      {/* ranura de ancho fijo, siempre presente: si el ✓ solo apareciera al
          completar, la columna de cifras saltaría horizontalmente al lado
          del borde derecho (visto igual que WorkoutLogScreen resolvió a mano) */}
      <View style={styles.checkSlot}>
        {isDone ? <Text style={styles.check}>✓</Text> : null}
      </View>
    </View>
  );

  return (
    <Animated.View style={[styles.row, animStyle]}>
      {onPress ? (
        <TouchableOpacity onPress={onPress} activeOpacity={0.6}>{contenido}</TouchableOpacity>
      ) : (
        contenido
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { borderTopWidth: 1, borderTopColor: colors.border },
  inner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md - 4 },
  info: { flex: 1 },
  label: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  labelActive: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  meta: { fontSize: 9, letterSpacing: 1, color: colors.textMuted, marginTop: 2 },
  metaActive: { color: colors.textPrimary },
  value: { fontFamily: fonts.mono, fontSize: 18, color: colors.textMuted },
  valueActive: { fontSize: 21, color: colors.textPrimary },
  valueDone: { fontSize: 16, color: colors.textMuted },
  unit: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted },
  checkSlot: { width: 20, alignItems: 'center' },
  check: { fontSize: 13, color: colors.textMuted },
});
