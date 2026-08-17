import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withDelay, withTiming, useReducedMotion,
} from 'react-native-reanimated';
import { colors, spacing, fonts } from '../../theme';
import { DURATION, DELAY } from '../../lib/motion';
import SectionLabel from './SectionLabel';

interface Props {
  /** la cifra, ya formateada */
  value: string;
  /** unidad pequeña pegada a la cifra: "kg" */
  unit?: string;
  /** continuación atenuada: "/5", "×8" */
  suffix?: string;
  /** etiqueta bajo la cifra, en mayúsculas */
  label: string;
  /** línea extra bajo la etiqueta */
  caption?: string;
  /** Anton para conteos, mono para pesos y marcas */
  font?: 'display' | 'mono';
  size?: number;
}

/**
 * La cifra que domina una pantalla.
 *
 * Aparece con un fundido, nunca contando hacia arriba: un contador envejece
 * mal y estas pantallas se abren muchas veces por sesión — en "Registrar
 * ejercicio", entre serie y serie.
 */
export default function StatHero({
  value, unit, suffix, label, caption, font = 'display', size = 52,
}: Props) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(reduced ? 1 : 0);

  React.useEffect(() => {
    if (reduced) {
      opacity.value = 1;
      return;
    }
    opacity.value = withDelay(DELAY.value, withTiming(1, { duration: DURATION.value }));
  }, [reduced]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const familia = font === 'mono' ? fonts.mono : fonts.display;

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.figure, animStyle]}>
        <Text style={[styles.value, { fontFamily: familia, fontSize: size }]}>{value}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
        {suffix ? (
          <Text style={[styles.suffix, { fontFamily: familia, fontSize: size * 0.46 }]}>{suffix}</Text>
        ) : null}
      </Animated.View>
      <SectionLabel>{label}</SectionLabel>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  figure: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  value: { color: colors.textPrimary },
  unit: { fontFamily: fonts.mono, fontSize: 13, color: colors.textMuted },
  suffix: { color: colors.textMuted },
  caption: { fontSize: 8, letterSpacing: 2, color: colors.textMuted, marginTop: 2, opacity: 0.7 },
});
