import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../../theme';
import { onQueueChange, pendingCount, flushQueue } from '../../lib/offline';

/** Aviso discreto cuando hay entrenamientos guardados en el teléfono sin subir. */
export default function SyncBanner() {
  const [pending, setPending] = useState(0);

  useEffect(() => {
    pendingCount().then(setPending);
    const unsub = onQueueChange(setPending);
    const t = setInterval(() => { flushQueue().then(setPending); }, 30000);
    return () => { unsub(); clearInterval(t); };
  }, []);

  if (pending === 0) return null;

  return (
    <View style={styles.banner}>
      <Ionicons name="cloud-offline-outline" size={14} color={colors.warning} />
      <Text style={styles.text}>
        {pending} registro{pending > 1 ? 's' : ''} sin subir · se sincroniza{pending > 1 ? 'n' : ''} solo
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.warning + '18',
    borderWidth: 1, borderColor: colors.warning + '55',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  text: { fontSize: 11, fontWeight: '700', color: colors.warning, flex: 1 },
});
