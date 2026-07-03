import React from 'react';
import { View, Text } from 'react-native';
import { colors } from '../../theme';

interface Props {
  data: Array<{ value: number; label: string; frontColor: string }>;
  maxVolume: number;
}

export default function VolumeChart({ data, maxVolume }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 160, gap: 8, paddingTop: 8 }}>
      {data.map((d, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
          <View style={{
            width: '100%',
            borderRadius: 4,
            backgroundColor: d.value > 0 ? colors.accent : colors.border,
            height: d.value > 0 ? Math.max((d.value / maxVolume) * 130, 4) : 4,
          }} />
          <Text style={{ fontSize: 9, fontWeight: '700', color: colors.textMuted }}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}
