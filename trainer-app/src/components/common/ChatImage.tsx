import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../../theme';
import { signedChatMediaUrl } from '../../lib/chat';

// Imagen del chat: miniatura en la burbuja + visor a pantalla completa al tocar.
export default function ChatImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [full, setFull] = useState(false);

  useEffect(() => {
    let ok = true;
    signedChatMediaUrl(path).then(u => { if (ok) setUrl(u); });
    return () => { ok = false; };
  }, [path]);

  if (!url) {
    return (
      <View style={[styles.thumb, styles.loading]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity onPress={() => setFull(true)} activeOpacity={0.9}>
        <Image source={{ uri: url }} style={styles.thumb} resizeMode="cover" />
      </TouchableOpacity>

      <Modal visible={full} transparent animationType="fade" onRequestClose={() => setFull(false)}>
        <Pressable style={styles.backdrop} onPress={() => setFull(false)}>
          <Image source={{ uri: url }} style={styles.fullImage} resizeMode="contain" />
          <TouchableOpacity style={styles.closeBtn} onPress={() => setFull(false)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 200, height: 200, borderRadius: radius.md, backgroundColor: colors.surface },
  loading: { alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  fullImage: { width: '100%', height: '80%' },
  closeBtn: { position: 'absolute', top: 56, right: 24 },
});
