import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import Body from 'react-native-body-highlighter';
import Dumbbell from '../common/Dumbbell';
import { aPartesDelCuerpo, ESCALA } from '../common/MuscleMap';
import { colors, spacing, radius, fonts } from '../../theme';
import { track } from '../../lib/analytics';

// La tarjeta que el alumno comparte al terminar — formato 4:5 (el que manda
// en el feed) y la gramática de las grandes (Strava, Nike Run Club): UNA
// cifra gigante como héroe y los datos como ficha técnica. Pero con lo que
// ninguna de ellas puede mostrar: el cuerpo con los músculos del día
// encendidos — ese mapa es nuestro.
//
// Monocromo estricto: la marca se reconoce por el negro, el Anton y la
// mancuerna, no por un color.
interface Props {
  dayName: string;
  durationSeconds: number;
  done: number;
  total: number;
  /** intensidad 0..1 por grupo muscular del día — enciende el mapa */
  muscles: Record<string, number>;
  onClose: () => void;
}

export default function ShareSessionCard({ dayName, durationSeconds, done, total, muscles, onClose }: Props) {
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const hoy = new Date();
  const fecha = `${String(hoy.getDate()).padStart(2, '0')}·${String(hoy.getMonth() + 1).padStart(2, '0')}·${hoy.getFullYear()}`;
  const minutos = Math.max(1, Math.round(durationSeconds / 60));
  const tieneMusculos = Object.keys(muscles).length > 0;

  // UN solo cuerpo (MuscleMap dibuja frontal Y posterior — acá no caben los
  // dos). El lado lo decide dónde cayó el trabajo del día.
  const GRUPOS_POSTERIORES = new Set([
    'Espalda alta', 'Espalda baja', 'Hombro posterior', 'Tríceps',
    'Isquiotibiales', 'Glúteo mayor', 'Glúteo medio', 'Glúteo menor', 'Gastrocnemios',
  ]);
  let atras = 0, adelante = 0;
  Object.entries(muscles).forEach(([g, v]) => {
    if (GRUPOS_POSTERIORES.has(g)) atras += v; else adelante += v;
  });
  const lado: 'front' | 'back' = atras > adelante ? 'back' : 'front';

  async function compartir() {
    if (sharing) return;
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png' });
        track('compartir_enviado', { segundos: durationSeconds });
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
        <View ref={cardRef} collapsable={false} style={styles.cardShell}>
          <LinearGradient
            colors={[colors.cardElevated, colors.background]}
            start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 1 }}
            style={styles.card}
          >
            <View style={styles.brandRow}>
              <Dumbbell size={18} />
              <Text style={styles.brand}>ELITEFITNESS</Text>
            </View>

            <View style={styles.cuerpo}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dayName}>{dayName.toUpperCase()}</Text>
                {/* la cifra ES el logro: gigante, a la Nike Run Club */}
                <Text style={styles.duracionNum}>{minutos}</Text>
                <Text style={styles.duracionUnidad}>MINUTOS</Text>
              </View>
              {tieneMusculos && (
                <View style={styles.mapa}>
                  <Body
                    data={aPartesDelCuerpo(muscles)}
                    side={lado}
                    gender="male"
                    scale={190 / 400}
                    colors={[...ESCALA]}
                    border={colors.borderLight}
                    defaultFill={colors.surface}
                  />
                </View>
              )}
            </View>

            <View style={styles.hairline} />
            <View style={styles.metaRow}>
              <Text style={styles.meta}>{done}/{total} EJERCICIOS</Text>
              <Text style={styles.meta}>{fecha}</Text>
            </View>
          </LinearGradient>
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
  // 4:5 — el formato del feed. El shell recorta el gradiente al radio.
  cardShell: { width: 320, height: 400, borderRadius: radius.lg, overflow: 'hidden' },
  card: {
    flex: 1, padding: 26, justifyContent: 'space-between',
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: { color: colors.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 3 },
  cuerpo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.md },
  dayName: {
    fontFamily: fonts.display, color: colors.textSecondary,
    fontSize: 20, letterSpacing: 1,
  },
  duracionNum: {
    fontFamily: fonts.display, color: colors.textPrimary,
    fontSize: 118, lineHeight: 118, marginTop: 2, letterSpacing: -2,
  },
  duracionUnidad: {
    fontFamily: fonts.mono, color: colors.textMuted,
    fontSize: 12, letterSpacing: 4, marginTop: 2,
  },
  mapa: { width: 120, alignItems: 'center' },
  hairline: { height: 1, backgroundColor: colors.border, marginBottom: 12 },
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
