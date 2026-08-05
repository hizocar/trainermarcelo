import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';
import { isBiometricSupported, isBiometricEnabled, setBiometricEnabled, authenticate } from '../../lib/biometricLock';
import { showAlert } from '../../lib/alert';

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [checking, setChecking] = useState(true);

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

  return (
    <View style={styles.container}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60, paddingHorizontal: spacing.xl, gap: spacing.lg },
  header: { gap: spacing.xs },
  backBtn: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
  headerTitle: { ...typography.display, fontSize: 30 },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  info: { flex: 1 },
  rowTitle: { ...typography.label, color: colors.textPrimary, letterSpacing: 1.5 },
  sub: { ...typography.caption, fontSize: 10, marginTop: 2 },
});
