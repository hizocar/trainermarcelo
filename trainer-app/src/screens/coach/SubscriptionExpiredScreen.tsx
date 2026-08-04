import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius, typography } from '../../theme';

// Se muestra en vez del panel de coach cuando la suscripción del gimnasio
// no está activa (pago atrasado o cancelada). El historial de los clientes
// no se toca — solo se pausa el acceso del coach hasta que se regularice.
export default function SubscriptionExpiredScreen() {
  const { user, signOut } = useAuth();
  const pastDue = user?.gymStatus === 'past_due';

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name={pastDue ? 'card-outline' : 'lock-closed-outline'} size={32} color={colors.accent} />
      </View>
      <Text style={styles.title}>{pastDue ? 'PAGO ATRASADO' : 'SUSCRIPCIÓN INACTIVA'}</Text>
      <Text style={styles.text}>
        {user?.is_owner
          ? pastDue
            ? 'El último cobro de tu suscripción falló. Actualiza tu método de pago para recuperar el acceso — tus datos y los de tus clientes están intactos.'
            : 'Tu suscripción no está activa. Puedes reactivarla cuando quieras — el historial de tus clientes se conserva.'
          : 'El gimnasio al que perteneces no tiene una suscripción activa en este momento. Contacta al dueño para regularizarla.'}
      </Text>

      {user?.is_owner && (
        <TouchableOpacity
          style={styles.btn}
          onPress={() => Linking.openURL('https://elitefitapp.com/subscription')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>GESTIONAR SUSCRIPCIÓN</Text>
        </TouchableOpacity>
      )}

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
  text: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: spacing.xl },
  btn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  btnText: { color: colors.background, fontWeight: '900', fontSize: 13, letterSpacing: 2 },
  signOutBtn: { paddingVertical: spacing.sm },
  signOutText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
});
