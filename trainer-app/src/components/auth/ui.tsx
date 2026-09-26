import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView,
  Platform, ActivityIndicator, ScrollView, type TextInputProps,
} from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';

// Piezas del registro propio (v49), con los mismos estilos del login: fondo
// del tema, etiquetas en mayúscula, campos y botones idénticos.

export function Pantalla({ children }: { children: React.ReactNode }) {
  return (
    <KeyboardAvoidingView style={styles.fondo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.contenido}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Titulo({ kicker, titulo, sub }: { kicker?: string; titulo: string; sub?: string }) {
  return (
    <View style={styles.titulo}>
      {kicker ? (
        <View style={styles.kickerFila}>
          <View style={styles.kickerBarra} />
          <Text style={styles.kicker}>{kicker}</Text>
        </View>
      ) : null}
      <Text style={styles.h1}>{titulo}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

export function Campo({ etiqueta, ayuda, ...props }: TextInputProps & { etiqueta: string; ayuda?: string }) {
  return (
    <View style={styles.campo}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <TextInput placeholderTextColor={colors.textMuted} {...props} style={[styles.input, props.multiline && styles.inputMulti, props.style]} />
      {ayuda ? <Text style={styles.ayuda}>{ayuda}</Text> : null}
    </View>
  );
}

export function BotonPrimario({ texto, onPress, cargando, deshabilitado }: {
  texto: string; onPress: () => void; cargando?: boolean; deshabilitado?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.boton, (cargando || deshabilitado) && styles.botonApagado]}
      onPress={onPress}
      disabled={cargando || deshabilitado}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={texto}
    >
      {cargando ? <ActivityIndicator color={colors.background} /> : <Text style={styles.botonTexto}>{texto}</Text>}
    </TouchableOpacity>
  );
}

export function BotonSecundario({ texto, onPress, deshabilitado }: { texto: string; onPress: () => void; deshabilitado?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.secundario, deshabilitado && styles.botonApagado]}
      onPress={onPress}
      disabled={deshabilitado}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={texto}
    >
      <Text style={styles.secundarioTexto}>{texto}</Text>
    </TouchableOpacity>
  );
}

export function Enlace({ texto, onPress }: { texto: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.enlace} accessibilityRole="link">
      <Text style={styles.enlaceTexto}>{texto}</Text>
    </TouchableOpacity>
  );
}

export function TextoError({ children }: { children: React.ReactNode }) {
  return <Text style={styles.error} selectable>{children}</Text>;
}

export const stylesIngreso = StyleSheet.create({
  separador: { ...typography.caption, textAlign: 'center', marginVertical: spacing.sm },
  grupo: { gap: spacing.md },
});

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: colors.background },
  contenido: {
    flexGrow: 1, justifyContent: 'center',
    paddingHorizontal: spacing.xl, paddingTop: spacing.xxl * 2, paddingBottom: spacing.xxl, gap: spacing.md,
  },
  titulo: { marginBottom: spacing.lg, gap: spacing.xs },
  kickerFila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  kickerBarra: { width: 28, height: 3, backgroundColor: colors.accent, borderRadius: radius.full },
  kicker: { ...typography.label, color: colors.textSecondary, letterSpacing: 3, fontSize: 10 },
  h1: { ...typography.display, fontSize: 34, lineHeight: 42, color: colors.textPrimary },
  sub: { ...typography.body, color: colors.textSecondary },
  campo: { gap: spacing.xs },
  etiqueta: { ...typography.label, letterSpacing: 2 },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight,
    borderRadius: radius.md, borderCurve: 'continuous',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md, color: colors.textPrimary, fontSize: 16,
  },
  inputMulti: { minHeight: 96, textAlignVertical: 'top' },
  ayuda: { ...typography.caption, fontSize: 11 },
  boton: {
    backgroundColor: colors.accent, borderRadius: radius.md, borderCurve: 'continuous',
    paddingVertical: spacing.md + 2, alignItems: 'center', marginTop: spacing.sm,
  },
  botonApagado: { opacity: 0.6 },
  botonTexto: { color: colors.background, fontSize: 15, fontWeight: '900', letterSpacing: 3 },
  secundario: {
    borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.md, borderCurve: 'continuous',
    paddingVertical: spacing.md + 2, alignItems: 'center',
  },
  secundarioTexto: { ...typography.label, color: colors.textPrimary, letterSpacing: 2 },
  enlace: { alignItems: 'center', paddingVertical: spacing.sm },
  enlaceTexto: { ...typography.label, color: colors.textSecondary, letterSpacing: 1.5, fontSize: 11 },
  error: { color: colors.danger, fontSize: 13, fontWeight: '500' },
});
