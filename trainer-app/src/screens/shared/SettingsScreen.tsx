import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Linking, ActivityIndicator, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';
import { isBiometricSupported, isBiometricEnabled, setBiometricEnabled, authenticate } from '../../lib/biometricLock';
import { showAlert, showConfirm } from '../../lib/alert';
import { supabase } from '../../lib/supabase';
import { temaActivo, elegirTema } from '../../lib/tema';
import { PALETAS, NOMBRES_TEMA, TEMAS, type NombreTema } from '../../theme/paletas';

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { user, signOut } = useAuth();
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tema, setTema] = useState<NombreTema>(() => temaActivo());
  const [guardandoTema, setGuardandoTema] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    (async () => {
      const sup = await isBiometricSupported();
      setSupported(sup);
      if (user?.id) setEnabled(await isBiometricEnabled(user.id));
      setChecking(false);
    })();
  }, [user?.id]);

  async function toggle(value: boolean) {
    if (!user?.id) return;
    if (value) {
      // pide autenticación antes de activar: confirma que Face ID funciona
      // en este dispositivo antes de dejar la app dependiendo de él
      const ok = await authenticate();
      if (!ok) {
        showAlert('No se pudo verificar', 'Revisa que Face ID esté configurado en los Ajustes de tu iPhone e intenta de nuevo.');
        return;
      }
    }
    await setBiometricEnabled(user.id, value);
    setEnabled(value);
  }

  async function cambiarTema(t: NombreTema) {
    if (!user?.id || guardandoTema || t === tema) return;
    setGuardandoTema(true);
    try {
      await elegirTema(t, user.id);
      setTema(t);
      showAlert('Apariencia guardada', 'Se aplicará la próxima vez que abras la app.');
    } catch (e: any) {
      showAlert('No se pudo guardar', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setGuardandoTema(false);
    }
  }

  // Borrar la cuenta (Google Play y Apple lo exigen). Dos confirmaciones: es
  // irreversible. La edge function delete-account hace el borrado completo en
  // una transacción (v47) y se niega si hay una suscripción cobrándose.
  const esCoach = user?.role === 'coach' || user?.role === 'coach_pending';

  function pedirEliminarCuenta() {
    showConfirm(
      'Eliminar tu cuenta',
      esCoach
        ? 'Se borrarán tu perfil, tus programas, tu biblioteca y tus videos. Tus alumnos conservan su cuenta, su plan y su historial, y quedan sin coach.'
        : 'Se borrarán tu perfil, tu plan, tu historial de entrenamientos, tus fotos y tus mensajes.',
      () => showConfirm(
        '¿Seguro?',
        'Esto no se puede deshacer.',
        eliminarCuenta,
        'Eliminar para siempre',
      ),
      'Continuar',
    );
  }

  async function eliminarCuenta() {
    setEliminando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { showAlert('Sesión expirada', 'Vuelve a iniciar sesión e inténtalo de nuevo.'); return; }
      const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
        },
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.ok) {
        showAlert('No se pudo eliminar', result.error ?? 'Inténtalo de nuevo en un momento.');
        return;
      }
      showAlert('Cuenta eliminada', 'Tu cuenta y tus datos fueron borrados.');
      await signOut();
    } catch {
      showAlert('Sin conexión', 'Revisa tu señal e inténtalo de nuevo.');
    } finally {
      setEliminando(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contenido}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={16} color={colors.textMuted} />
          <Text style={styles.backText}>ATRÁS</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AJUSTES</Text>
      </View>

      <Card style={styles.card}>
        <View style={styles.row}>
          <Ionicons name="scan-outline" size={18} color={colors.accent} />
          <View style={styles.info}>
            <Text style={styles.rowTitle}>DESBLOQUEO CON FACE ID</Text>
            <Text style={styles.sub}>
              {supported
                ? 'Pide Face ID (o tu huella) cada vez que abres la app'
                : 'Este dispositivo no tiene Face ID / Touch ID configurado'}
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={toggle}
            disabled={!supported || checking}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={colors.textPrimary}
          />
        </View>
      </Card>

      <Card style={styles.card}>
        <View style={styles.row}>
          <Ionicons name="color-palette-outline" size={18} color={colors.accent} />
          <View style={styles.info}>
            <Text style={styles.rowTitle}>APARIENCIA</Text>
            <Text style={styles.sub}>Elige tu tema — se aplica al reabrir la app y te sigue en el panel web</Text>
          </View>
        </View>
        <View style={styles.temas}>
          {TEMAS.map((t) => {
            const p = PALETAS[t];
            const activo = t === tema;
            return (
              <TouchableOpacity
                key={t}
                style={[styles.temaOpcion, activo && styles.temaActivo]}
                onPress={() => cambiarTema(t)}
                disabled={guardandoTema}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: activo }}
                accessibilityLabel={`Tema ${NOMBRES_TEMA[t]}`}
              >
                {/* muestra de la paleta: fondo + acento, tal cual se verá */}
                <View style={[styles.temaMuestra, { backgroundColor: p.background, borderColor: p.border }]}>
                  <View style={[styles.temaAcento, { backgroundColor: p.accent }]} />
                </View>
                <Text style={[styles.temaNombre, activo && { color: colors.textPrimary }]}>
                  {NOMBRES_TEMA[t].toUpperCase()}
                </Text>
                {activo && <Ionicons name="checkmark" size={13} color={colors.accent} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      <Card style={styles.card}>
        <TouchableOpacity
          style={styles.row}
          onPress={() => Linking.openURL('https://wa.me/56949684325').catch(() => {
            // sin WhatsApp ni navegador que lo tome (Sentry REACT-NATIVE-1):
            // al menos dejarle el número a mano
            showAlert('No se pudo abrir WhatsApp', 'Escríbenos al +56 9 4968 4325.');
          })}
          activeOpacity={0.8}
        >
          <Ionicons name="logo-whatsapp" size={18} color={colors.accent} />
          <View style={styles.info}>
            <Text style={styles.rowTitle}>DUDAS COMERCIALES</Text>
            <Text style={styles.sub}>Escríbenos por WhatsApp — +56 9 4968 4325</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </Card>

      {/* al final y sin color: se encuentra, pero no invita a tocarlo */}
      <TouchableOpacity
        style={styles.eliminar}
        onPress={pedirEliminarCuenta}
        disabled={eliminando}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Eliminar mi cuenta"
      >
        {eliminando
          ? <ActivityIndicator size="small" color={colors.textMuted} />
          : <Text style={styles.eliminarTexto}>ELIMINAR MI CUENTA</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  contenido: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.lg },
  eliminar: { alignSelf: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  eliminarTexto: { ...typography.label, color: colors.textMuted, letterSpacing: 1.5, textDecorationLine: 'underline' },
  header: { gap: spacing.xs },
  backBtn: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
  headerTitle: { ...typography.display, fontSize: 30 },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  info: { flex: 1 },
  rowTitle: { ...typography.label, color: colors.textPrimary, letterSpacing: 1.5 },
  sub: { ...typography.caption, fontSize: 10, marginTop: 2 },
  temas: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  temaOpcion: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingVertical: 8, paddingHorizontal: 10,
  },
  temaActivo: { borderColor: colors.accent },
  temaMuestra: {
    width: 26, height: 18, borderRadius: 5, borderWidth: 1,
    alignItems: 'flex-end', justifyContent: 'flex-end', padding: 3,
  },
  temaAcento: { width: 8, height: 8, borderRadius: 4 },
  temaNombre: { ...typography.caption, fontSize: 10, letterSpacing: 1, color: colors.textMuted },
});
