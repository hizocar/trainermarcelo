import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
  ImageBackground,
  ScrollView,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius, typography } from '../../theme';

export default function LoginScreen() {
  const { signIn, signUpCoach } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // registro de entrenador
  const [showCoach, setShowCoach] = useState(false);
  const [cName, setCName] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cPass, setCPass] = useState('');
  const [cError, setCError] = useState('');
  const [cLoading, setCLoading] = useState(false);
  const [cDone, setCDone] = useState(false);

  async function handleCoachSignup() {
    if (!cName.trim() || !cEmail.trim() || cPass.length < 8) {
      setCError('Nombre, email y contraseña de mínimo 8 caracteres.');
      return;
    }
    setCLoading(true); setCError('');
    const { error } = await signUpCoach(cName, cEmail, cPass);
    setCLoading(false);
    if (error) setCError(error);
    else setCDone(true);
  }

  async function handleLogin() {
    if (!email || !password) { setError('Completa todos los campos'); return; }
    setLoading(true);
    setError('');
    const { error } = await signIn(email.trim(), password);
    if (error) setError(error);
    setLoading(false);
  }

  return (
    <ImageBackground
      source={require('../../../assets/hero-marcelo.jpg')}
      style={styles.hero}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['rgba(10,10,10,0.25)', 'rgba(10,10,10,0.75)', '#0A0A0A']}
        locations={[0, 0.55, 0.88]}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.brandBar} />
            <Text style={styles.brandKicker}>ENTRENAMIENTO PERSONALIZADO</Text>
          </View>
          <Text style={styles.logo}>ELITE</Text>
          <Text style={styles.logoAccent}>FITNESS</Text>
          <Text style={styles.subtitle}>TU PLAN · TU PROGRESO · EN SERIO</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>EMAIL</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="tu@email.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>CONTRASEÑA</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              onSubmitEditing={handleLogin}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={colors.background} />
              : <Text style={styles.buttonText}>ENTRAR</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.coachLink} onPress={() => { setShowCoach(true); setCDone(false); setCError(''); }}>
            <Text style={styles.coachLinkText}>¿ERES ENTRENADOR? SOLICITA TU CUENTA</Text>
          </TouchableOpacity>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showCoach} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            {cDone ? (
              <>
                <Text style={styles.modalTitle}>SOLICITUD ENVIADA</Text>
                <Text style={styles.modalBody}>
                  Tu cuenta de entrenador quedó en revisión. Te avisaremos cuando
                  sea aprobada; luego inicia sesión con tu email y contraseña.
                </Text>
                <TouchableOpacity style={styles.button} onPress={() => setShowCoach(false)}>
                  <Text style={styles.buttonText}>ENTENDIDO</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>SOLICITAR CUENTA DE ENTRENADOR</Text>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>NOMBRE</Text>
                  <TextInput style={styles.input} value={cName} onChangeText={setCName}
                    placeholder="Tu nombre" placeholderTextColor={colors.textMuted} autoCapitalize="words" />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>EMAIL</Text>
                  <TextInput style={styles.input} value={cEmail} onChangeText={setCEmail}
                    placeholder="tu@email.com" placeholderTextColor={colors.textMuted}
                    keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>CONTRASEÑA</Text>
                  <TextInput style={styles.input} value={cPass} onChangeText={setCPass}
                    placeholder="Mínimo 8 caracteres" placeholderTextColor={colors.textMuted} secureTextEntry />
                </View>
                {cError ? <Text style={styles.errorText}>{cError}</Text> : null}
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCoach(false)}>
                    <Text style={styles.cancelBtnText}>CANCELAR</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.button, styles.modalBtn]} onPress={handleCoachSignup} disabled={cLoading}>
                    {cLoading ? <ActivityIndicator color={colors.background} /> : <Text style={styles.buttonText}>SOLICITAR</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.xxl * 2,
  },
  header: {
    marginBottom: spacing.xl,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  brandBar: {
    width: 28,
    height: 3,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
  },
  brandKicker: {
    ...typography.label,
    color: colors.textSecondary,
    letterSpacing: 3,
    fontSize: 10,
  },
  logo: {
    ...typography.display,
    fontSize: 46,
    lineHeight: 58,
    color: colors.textPrimary,
  },
  logoAccent: {
    ...typography.display,
    fontSize: 46,
    lineHeight: 58,
    color: colors.accent,
  },
  subtitle: {
    ...typography.label,
    marginTop: spacing.sm,
    letterSpacing: 4,
    color: colors.textSecondary,
  },
  form: {
    gap: spacing.md,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  inputLabel: {
    ...typography.label,
    letterSpacing: 2,
  },
  input: {
    backgroundColor: 'rgba(22, 22, 22, 0.92)',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: 16,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '500',
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 3,
  },
  coachLink: { alignItems: 'center', paddingVertical: spacing.md },
  coachLinkText: { ...typography.label, color: colors.textSecondary, letterSpacing: 1.5, fontSize: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: colors.surface, borderTopLeftRadius: 36, borderTopRightRadius: 36,
    padding: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md,
  },
  modalTitle: { ...typography.h2, marginBottom: spacing.xs },
  modalBody: { ...typography.body, color: colors.textSecondary },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  modalBtn: { flex: 1, marginTop: 0 },
  cancelBtn: { flex: 1, paddingVertical: spacing.md + 2, alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  cancelBtnText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
});
