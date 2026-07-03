import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { colors, radius, spacing, typography } from '../../theme';
import { isUploadedVideo } from '../../lib/media';

// Videos subidos al bucket → reproductor inline; links externos (YouTube) → abrir fuera.
export default function ExerciseVideo({ url }: { url: string }) {
  if (isUploadedVideo(url)) return <InlinePlayer url={url} />;

  return (
    <TouchableOpacity style={styles.linkBtn} onPress={() => Linking.openURL(url)} activeOpacity={0.8}>
      <Ionicons name="play-circle" size={18} color={colors.accent} />
      <Text style={styles.linkText}>VER VIDEO DEL EJERCICIO</Text>
      <Ionicons name="open-outline" size={14} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

function InlinePlayer({ url }: { url: string }) {
  const player = useVideoPlayer(url, p => {
    p.loop = true;
    p.muted = true;
  });

  return (
    <View style={styles.playerBox}>
      <VideoView
        player={player}
        style={styles.player}
        contentFit="contain"
        nativeControls
      />
    </View>
  );
}

const styles = StyleSheet.create({
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  linkText: { ...typography.label, color: colors.accent, letterSpacing: 1.5 },
  playerBox: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  player: { width: '100%', height: 220 },
});
