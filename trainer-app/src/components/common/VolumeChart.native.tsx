import React from 'react';
import { View, Dimensions } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { colors, spacing } from '../../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface Props {
  data: Array<{ value: number; label: string; frontColor: string }>;
  maxVolume: number;
}

export default function VolumeChart({ data, maxVolume }: Props) {
  return (
    <View style={{ marginLeft: -spacing.sm }}>
      <BarChart
        data={data}
        barWidth={28}
        spacing={12}
        roundedTop
        hideRules
        xAxisThickness={0}
        yAxisThickness={0}
        yAxisTextStyle={{ color: colors.textMuted, fontSize: 10 }}
        xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 10, fontWeight: '700' }}
        noOfSections={4}
        maxValue={Math.ceil(maxVolume * 1.2)}
        barBorderRadius={4}
        width={SCREEN_WIDTH - spacing.xl * 2 - spacing.md * 2 - 40}
        height={160}
        backgroundColor="transparent"
      />
    </View>
  );
}
