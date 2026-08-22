import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { colors, spacing, radius, fonts } from '../../theme';
import { formatDuration } from '../../lib/sessionTimer';

// La tarjeta que el alumno comparte al terminar su sesión — el camino que
// describía docs/negocio/2026-08-20-compartir-imagen.md: se dibuja como vista
// normal, view-shot la vuelve PNG, y la hoja de compartir de iOS hace el
// resto (Instagram, WhatsApp, lo que tenga instalado). Sin servidor.
//
// Cuadrada a propósito: es el formato que sirve igual en feed y en historias,
// y el monocromo de la marca la hace reconocible en cualquier red.
interface Props {
  dayName: string;
  durationSeconds: number;
  done: number;
  total: number;
  onClose: () => void;
}

export default function ShareSessionCard({ dayName, durationSeconds, done, total, onClose }: Props) {
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const hoy = new Date();
  const fecha = `${hoy.getDate()}·${String(hoy.getMonth() + 1).padStart(2, '0')}·${hoy.getFullYear()}`;

  async function compartir() {
    if (sharing) return;
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png' });
      }
    } catch {
      // si la captura falla no hay nada que guardar ni que romper
    } finally {
      setSharing(false);
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* La tarjeta: lo que sale en la imagen es EXACTAMENTE esto */}
        <View ref={cardRef} collapsable={false} style={styles.card}>
          <Text style={styles.brand}>ELITEFITNESS</Text>

          <Text style={styles.dayName}>{dayName.toUpperCase()}</Text>
          <Text style={styles.duration}>{formatDuration(durationSeconds)}</Text>

          <View style={styles.metaRow}>
            <Text style={styles.meta}>{done}/{total} EJERCICIOS</Text>
            <Text style={styles.meta}>{fecha}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.shareBtn} onPress={compartir} disabled={sharing} activeOpacity={0.85}>
            <Text style={styles.shareBtnText}>{sharing ? 'PREPARANDO…' : 'COMPARTIR'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.closeText}>CERRAR</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center', justifyContent: 'center', padding: spacing.xl,
  },
  card: {
    width: 320, height: 320, backgroundColor: colors.background,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: 28, justifyContent: 'space-between',
  },
  brand: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 3 },
  dayName: {
    fontFamily: fonts.display, color: colors.textSecondary,
    fontSize: 22, letterSpacing: 1,
  },
  // la duración ES el logro: la cifra más grande de la tarjeta
  duration: { fontFamily: fonts.display, color: colors.textPrimary, fontSize: 64, lineHeight: 66 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: {
    fontFamily: fonts.mono, color: colors.textMuted,
    fontSize: 11, letterSpacing: 1.5,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: spacing.xl },
  shareBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: 12, paddingHorizontal: 28,
  },
  shareBtnText: { color: colors.background, fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  closeText: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 2 },
});
