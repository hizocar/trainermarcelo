import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius, typography } from '../../theme';

// Un coach registrado pero aún no aprobado por el dueño ve esta pantalla.
export default function CoachPendingScreen() {
  const { user, signOut, refreshProfile } = useAuth();
  const [checking, setChecking] = useState(false);

  async function check() {
    setChecking(true);
    await refreshProfile();
    setChecking(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="hourglass-outline" size={44} color={colors.accent} />
      </View>

      <Text style={styles.title}>CUENTA EN REVISIÓN</Text>
      <Text style={styles.body}>
        Hola {user?.name?.split(' ')[0]}, recibimos tu solicitud como entrenador.
      </Text>
      <Text style={styles.body}>
        Tu cuenta está siendo revisada. Cuando sea aprobada, podrás crear tus
        clientes y planes de entrenamiento.
      </Text>

      <TouchableOpacity style={styles.btn} onPress={check} disabled={checking} activeOpacity={0.85}>
        {checking
          ? <ActivityIndicator color={colors.background} />
          : <Text style={styles.btnText}>YA FUI APROBADO · ACTUALIZAR</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={signOut} style={styles.logout}>
        <Text style={styles.logoutText}>CERRAR SESIÓN</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  iconWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent + '55',
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  title: { ...typography.display, fontSize: 28, textAlign: 'center' },
  body: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  btn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: spacing.md + 2, paddingHorizontal: spacing.xl,
    alignItems: 'center', marginTop: spacing.lg, alignSelf: 'stretch',
  },
  btnText: { color: colors.background, fontWeight: '900', fontSize: 13, letterSpacing: 1.5 },
  logout: { padding: spacing.md },
  logoutText: { ...typography.label, color: colors.danger, letterSpacing: 2 },
});
