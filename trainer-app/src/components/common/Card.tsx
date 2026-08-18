import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing, cardShadow } from '../../theme';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  /** tarjeta destacada: borde lima y fondo con tinte del acento */
  highlight?: boolean;
}

export default function Card({ children, style, highlight }: Props) {
  return (
    <LinearGradient
      colors={
        highlight
          // el destacado se marca con brillo, no con color: el verde lima era
          // del sistema anterior al monocromo
          ? ['rgba(216,217,215,0.07)', 'rgba(216,217,215,0.02)']
          : [colors.cardElevated, colors.card]
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 0.7, y: 1 }}
      style={[styles.card, highlight && styles.cardHighlight, style]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...(cardShadow as object),
  },
  cardHighlight: { borderColor: colors.accent + '55' },
});
