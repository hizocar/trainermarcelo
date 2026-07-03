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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius, typography } from '../../theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.brandBar} />
            <Text style={styles.brandKicker}>ENTRENAMIENTO PERSONALIZADO</Text>
          </View>
          <Text style={styles.logo}>MARCELO</Text>
          <Text style={styles.logoAccent}>HERRERA</Text>
          <Text style={styles.subtitle}>COACH · THERAPIST</Text>
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
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
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
    fontSize: 56,
    lineHeight: 60,
    color: colors.textPrimary,
  },
  logoAccent: {
    ...typography.display,
    fontSize: 56,
    lineHeight: 60,
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
});
