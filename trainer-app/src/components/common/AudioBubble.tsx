import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { colors, spacing } from '../../theme';
import { signedChatMediaUrl } from '../../lib/chat';

// Reproductor de nota de voz dentro de una burbuja del chat.
export default function AudioBubble({ path, mine }: { path: string; mine: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const player = useAudioPlayer(url ? { uri: url } : null);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    let ok = true;
    signedChatMediaUrl(path).then(u => { if (ok) setUrl(u); });
    return () => { ok = false; };
  }, [path]);

  const tint = mine ? colors.background : colors.accent;
  const playing = status.playing;
  const dur = status.duration || 0;
  const pos = status.currentTime || 0;
  const pct = dur > 0 ? Math.min(pos / dur, 1) : 0;

  function toggle() {
    if (!url) return;
    if (playing) { player.pause(); return; }
    if (dur > 0 && pos >= dur - 0.1) player.seekTo(0);
    player.play();
  }

  return (
    <TouchableOpacity style={styles.row} onPress={toggle} activeOpacity={0.7} disabled={!url}>
      {!url ? (
        <ActivityIndicator color={tint} size="small" />
      ) : (
        <Ionicons name={playing ? 'pause' : 'play'} size={20} color={tint} />
      )}
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: tint }]} />
      </View>
      <Text style={[styles.time, { color: tint }]}>
        {fmt(playing || pos > 0 ? pos : dur)}
      </Text>
    </TouchableOpacity>
  );
}

function fmt(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 160 },
  barTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.35)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2 },
  time: { fontSize: 11, fontWeight: '700', minWidth: 34, textAlign: 'right' },
});
