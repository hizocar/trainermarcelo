import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

interface Props {
  label: string;
  value: string;
  sublabel?: string;
  accent?: boolean;
}

export default function StatCard({ label, value, sublabel, accent }: Props) {
  return (
    <View style={[styles.card, accent && styles.cardAccent]}>
      <Text style={[styles.value, accent && styles.valueAccent]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.label, accent && styles.labelAccent]}>{label}</Text>
      {sublabel ? <Text style={[styles.sublabel, accent && styles.labelAccent]}>{sublabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 2,
  },
  cardAccent: { backgroundColor: colors.accent, borderColor: colors.accent },
  value: { fontSize: 22, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.5 },
  valueAccent: { color: colors.background },
  label: { ...typography.label, letterSpacing: 1.5 },
  labelAccent: { color: colors.background, opacity: 0.7 },
  sublabel: { ...typography.caption, fontSize: 10 },
});
