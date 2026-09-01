import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, AppState } from 'react-native';
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

  // El reproductor nativo NO sobrevive al segundo plano. Bloquear el teléfono
  // a mitad de un ejercicio y volver hacía caer la app a veces: la familia de
  // bugs de ciclo de vida de expo-video (AVPlayer retomando en estado rancio).
  // Al irse del primer plano se pausa y se DESMONTA la vista; al volver se
  // monta fresca — nunca hay un reproductor "resucitando".
  const [enPrimerPlano, setEnPrimerPlano] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', estado => {
      const activo = estado === 'active';
      if (!activo) {
        try { player.pause(); } catch { /* pausar jamás puede botar la app */ }
      }
      setEnPrimerPlano(activo);
    });
    return () => sub.remove();
  }, [player]);

  if (!enPrimerPlano) return <View style={styles.playerBox} />;

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
