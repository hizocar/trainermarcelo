import React from 'react';
import { Text, StyleSheet, TextStyle, StyleProp } from 'react-native';
import { colors } from '../../theme';

interface Props {
  children: string;
  style?: StyleProp<TextStyle>;
}

/**
 * La etiqueta que encabeza una sección. Estaba copiada con medidas apenas
 * distintas en cinco pantallas — que sea un componente es lo que evita que
 * vuelvan a divergir.
 */
export default function SectionLabel({ children, style }: Props) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: { fontSize: 8, fontWeight: '800', letterSpacing: 2, color: colors.textMuted },
});
