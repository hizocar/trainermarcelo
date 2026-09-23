import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius, typography } from '../../theme';

// Se muestra en vez del panel de coach cuando el gimnasio no tiene el panel
// abierto. Tres casos, no dos: pago atrasado, suscripción cancelada, y la
// cuenta gratis del marketplace — que nunca tuvo una suscripción, así que
// hablarle de "reactivar" o mandarla a pagar es un error. A esa se la invita
// a postular a solicitudes en la web: al tomar la primera se abre su mes de
// regalo ('free_month') y este bloqueo desaparece solo.
// El historial de los clientes no se toca en ningún caso.
export default function SubscriptionExpiredScreen() {
  const { user, signOut } = useAuth();
  const pastDue = user?.gymStatus === 'past_due';
  const marketplace = user?.gymStatus === 'marketplace';

  const icon = marketplace ? 'people-outline' : pastDue ? 'card-outline' : 'lock-closed-outline';
  const title = marketplace ? 'AÚN SIN ALUMNOS' : pastDue ? 'PAGO ATRASADO' : 'SUSCRIPCIÓN INACTIVA';

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={32} color={colors.accent} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>
        {marketplace
          ? 'Tu cuenta del marketplace está lista. Postula a solicitudes de alumnos desde el panel web: al tomar tu primera solicitud se abre tu mes de regalo con acceso completo.'
          : user?.is_owner
            ? pastDue
              ? 'El último cobro de tu suscripción falló. Actualiza tu método de pago para recuperar el acceso — tus datos y los de tus clientes están intactos.'
              : 'Tu suscripción no está activa. Puedes reactivarla cuando quieras — el historial de tus clientes se conserva.'
            : 'El gimnasio al que perteneces no tiene una suscripción activa en este momento. Contacta al dueño para regularizarla.'}
      </Text>

      {/* Google Play no acepta que una app lleve a pagar fuera de su sistema
          (Apple sí lo aceptó). En Android se indica dónde hacerlo, sin botón
          ni enlace: la suscripción del coach se gestiona en el panel web. */}
      {user?.is_owner && (Platform.OS === 'ios' ? (
        <TouchableOpacity
          style={styles.btn}
          onPress={() => Linking.openURL(
            marketplace ? 'https://elitefitapp.com/marketplace' : 'https://elitefitapp.com/subscription',
          )}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>{marketplace ? 'VER SOLICITUDES' : 'GESTIONAR SUSCRIPCIÓN'}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.webHint} selectable>
          {marketplace
            ? 'Revisa las solicitudes desde tu panel en elitefitapp.com'
            : 'Tu suscripción se gestiona desde tu panel en elitefitapp.com'}
        </Text>
      ))}

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
  webHint: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md },
  signOutBtn: { paddingVertical: spacing.sm },
  signOutText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
});
