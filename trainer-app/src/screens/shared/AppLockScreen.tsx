import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius, typography } from '../../theme';

// Reemplaza toda la app mientras está bloqueada. Se intenta desbloquear
// automáticamente al mostrarse (así el usuario no tiene que tocar nada la
// mayoría de las veces); si Face ID falla o lo cancela, queda este botón.
export default function AppLockScreen({ onUnlock }: { onUnlock: () => Promise<boolean> }) {
  const { signOut } = useAuth();
  const [trying, setTrying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => { attempt(); }, []);

  async function attempt() {
    setTrying(true);
    setFailed(false);
    const ok = await onUnlock();
    setTrying(false);
    if (!ok) setFailed(true);
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="lock-closed-outline" size={32} color={colors.accent} />
      </View>
      <Text style={styles.title}>EliteFitness bloqueada</Text>
      <Text style={styles.text}>
        {failed ? 'No se pudo verificar tu identidad. Intenta de nuevo.' : 'Verificando…'}
      </Text>

      <TouchableOpacity style={styles.btn} onPress={attempt} disabled={trying} activeOpacity={0.85}>
        <Text style={styles.btnText}>{trying ? 'VERIFICANDO…' : 'DESBLOQUEAR'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={signOut} style={styles.signOutBtn}>
        <Text style={styles.signOutText}>CERRAR SESIÓN</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  iconWrap: {
    width: 64, height: 64, borderRadius: radius.full,
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
  },
  title: { ...typography.display, fontSize: 22, marginBottom: spacing.sm, textAlign: 'center' },
  text: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl },
  btn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  btnText: { color: colors.background, fontWeight: '900', fontSize: 13, letterSpacing: 2 },
  signOutBtn: { paddingVertical: spacing.sm },
  signOutText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
});
