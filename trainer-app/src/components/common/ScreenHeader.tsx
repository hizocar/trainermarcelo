import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';

interface Props {
  /** texto de la izquierda: fecha o título, ya en mayúsculas */
  left: string;
  /** lo que va a la derecha: navegación de semana, un botón, o nada */
  right?: React.ReactNode;
  /** si se pasa, la izquierda se vuelve un botón "atrás" */
  onBack?: () => void;
}

/**
 * La barra superior de una pantalla del alumno. Deliberadamente liviana: en
 * este lenguaje la cabecera no compite, el dato héroe manda.
 */
export default function ScreenHeader({ left, right, onBack }: Props) {
  return (
    <View style={styles.bar}>
      {onBack ? (
        <TouchableOpacity
          style={styles.back}
          onPress={onBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={13} color={colors.textMuted} />
          <Text style={styles.text}>{left}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.text}>{left}</Text>
      )}
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingTop: spacing.xs,
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -4 },
  text: { fontSize: 9, letterSpacing: 2, fontWeight: '800', color: colors.textMuted },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
