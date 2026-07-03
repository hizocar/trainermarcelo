import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, radius } from '../../theme';

interface Props {
  name: string;
  imageUrl?: string | null;
  size?: number;
  accent?: boolean;
}

export default function Avatar({ name, imageUrl, size = 52, accent }: Props) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const box = { width: size, height: size, borderRadius: radius.full };

  if (imageUrl) {
    return <Image source={{ uri: imageUrl }} style={[box, styles.image]} />;
  }

  return (
    <View style={[box, styles.circle, accent && styles.circleAccent]}>
      <Text style={[styles.text, accent && styles.textAccent, { fontSize: size * 0.34 }]}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.surface },
  circle: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleAccent: { backgroundColor: colors.accent, borderColor: colors.accent },
  text: { color: colors.accent, fontWeight: '900' },
  textAccent: { color: colors.background },
});
