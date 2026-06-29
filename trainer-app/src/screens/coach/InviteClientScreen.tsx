import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Invitation } from '../../types';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';

export default function InviteClientScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  useEffect(() => { fetchInvitations(); }, []);

  async function fetchInvitations() {
    const { data } = await supabase
      .from('invitations')
      .select('*')
      .eq('coach_id', user!.id)
      .order('created_at', { ascending: false });
    setInvitations(data ?? []);
    setLoadingList(false);
  }

  async function inviteClient() {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Campos incompletos', 'Completa nombre, email y contraseña temporal.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Contraseña muy corta', 'Mínimo 6 caracteres.');
      return;
    }

    setLoading(true);

    // Crear usuario en Supabase Auth con service role via Edge Function
    // Por ahora usamos la API de auth admin directamente
    const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/invite-client`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), password, coach_id: user!.id }),
    });

    if (!res.ok) {
      // Fallback: registrar en invitaciones para procesamiento manual
      const { error } = await supabase.from('invitations').insert({
        coach_id: user!.id,
        email: email.trim().toLowerCase(),
        name: name.trim(),
        status: 'pending',
      });

      if (!error) {
        Alert.alert(
          'Invitación registrada',
          `${name} fue agregado a la lista de invitaciones. Pídele que descargue la app y use:\n\nEmail: ${email}\nContraseña: ${password}\n\n(Debes crear su cuenta manualmente en Supabase por ahora)`,
          [{ text: 'OK' }]
        );
        setInvitations(prev => [{
          id: Date.now().toString(), coach_id: user!.id,
          email: email.trim().toLowerCase(), name: name.trim(),
          status: 'pending', created_at: new Date().toISOString(),
        }, ...prev]);
        setName(''); setEmail(''); setPassword('');
      }
    } else {
      const result = await res.json();
      if (result.error) {
        Alert.alert('Error', result.error);
      } else {
        Alert.alert('¡Listo!', `${name} fue invitado exitosamente.\n\nEmail: ${email}\nContraseña: ${password}`);
        setName(''); setEmail(''); setPassword('');
        fetchInvitations();
      }
    }

    setLoading(false);
  }

  async function removeInvitation(id: string) {
    await supabase.from('invitations').delete().eq('id', id);
    setInvitations(prev => prev.filter(i => i.id !== id));
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← ATRÁS</Text>
        </TouchableOpacity>
        <Text style={styles.title}>INVITAR CLIENTE</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card style={styles.formCard}>
          <Text style={styles.formTitle}>NUEVO CLIENTE</Text>

          <View style={styles.field}>
            <Text style={styles.label}>NOMBRE COMPLETO</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="ej: Juan Pérez"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="juan@email.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>CONTRASEÑA TEMPORAL</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.inviteBtn, loading && styles.inviteBtnDisabled]}
            onPress={inviteClient}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color={colors.background} />
              : <Text style={styles.inviteBtnText}>AGREGAR CLIENTE</Text>
            }
          </TouchableOpacity>
        </Card>

        <Text style={styles.sectionLabel}>CLIENTES INVITADOS</Text>

        {loadingList ? (
          <ActivityIndicator color={colors.accent} />
        ) : invitations.length === 0 ? (
          <Text style={styles.emptyText}>No hay invitaciones aún</Text>
        ) : (
          invitations.map(inv => (
            <Card key={inv.id} style={styles.invCard}>
              <View style={styles.invRow}>
                <View style={styles.invAvatar}>
                  <Text style={styles.invAvatarText}>{inv.name[0].toUpperCase()}</Text>
                </View>
                <View style={styles.invInfo}>
                  <Text style={styles.invName}>{inv.name}</Text>
                  <Text style={styles.invEmail}>{inv.email}</Text>
                </View>
                <View style={[styles.statusBadge, inv.status === 'accepted' && styles.statusBadgeAccepted]}>
                  <Text style={[styles.statusText, inv.status === 'accepted' && styles.statusTextAccepted]}>
                    {inv.status === 'accepted' ? 'ACTIVO' : 'PENDIENTE'}
                  </Text>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  header: { paddingHorizontal: spacing.xl, marginBottom: spacing.lg, gap: spacing.sm },
  backText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
  title: { fontSize: 28, fontWeight: '900', color: colors.textPrimary, letterSpacing: -1 },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },

  formCard: { gap: spacing.md },
  formTitle: { ...typography.h3, color: colors.accent, letterSpacing: 1 },
  field: { gap: spacing.xs },
  label: { ...typography.label, letterSpacing: 2 },
  input: {
    backgroundColor: colors.background, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    color: colors.textPrimary, fontSize: 15,
  },
  inviteBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: spacing.md + 2, alignItems: 'center', marginTop: spacing.sm,
  },
  inviteBtnDisabled: { opacity: 0.6 },
  inviteBtnText: { color: colors.background, fontWeight: '900', fontSize: 13, letterSpacing: 2 },

  sectionLabel: { ...typography.label, letterSpacing: 3 },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },

  invCard: { },
  invRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  invAvatar: {
    width: 44, height: 44, borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  invAvatarText: { color: colors.accent, fontWeight: '900', fontSize: 16 },
  invInfo: { flex: 1 },
  invName: { ...typography.h3 },
  invEmail: { ...typography.caption, marginTop: 2 },
  statusBadge: {
    borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.border,
  },
  statusBadgeAccepted: { borderColor: colors.success, backgroundColor: colors.success + '22' },
  statusText: { ...typography.caption, color: colors.textMuted, letterSpacing: 1 },
  statusTextAccepted: { color: colors.success },
});
