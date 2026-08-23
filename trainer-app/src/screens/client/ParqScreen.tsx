import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius, fonts } from '../../theme';
import { PARQ_PREGUNTAS, parqCompleto } from '../../lib/parq';
import { track } from '../../lib/analytics';

// La ficha de ingreso (PAR-Q): 7 sí/no y un comentario libre. El alumno la
// responde una vez y su coach la lee en el panel. Cualquier "sí" no bloquea
// nada — informa al coach, que es quien decide cómo entrenarlo.
export default function ParqScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [respuestas, setRespuestas] = useState<Record<string, boolean>>({});
  const [comentario, setComentario] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completo = parqCompleto(respuestas);

  async function guardar() {
    if (!completo || guardando || !user) return;
    setGuardando(true);
    setError(null);
    const { error: err } = await supabase.from('client_forms').upsert(
      {
        client_id: user.id, kind: 'parq',
        answers: { ...respuestas, comentario: comentario.trim() || null },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'client_id,kind' },
    );
    setGuardando(false);
    if (err) { setError('No se pudo guardar. Inténtalo de nuevo.'); return; }
    track('parq_completado', { positivas: Object.values(respuestas).filter(Boolean).length });
    navigation.goBack();
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.volver}>← VOLVER</Text>
        </TouchableOpacity>

        <Text style={styles.titulo}>FICHA INICIAL</Text>
        <Text style={styles.sub}>
          Siete preguntas rápidas para que tu coach te conozca antes de armar tu
          plan. Responder "sí" a algo no te impide entrenar — le dice a tu coach
          qué cuidar.
        </Text>

        {PARQ_PREGUNTAS.map((p, i) => (
          <View key={p.id} style={styles.pregunta}>
            <Text style={styles.preguntaNum}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.preguntaTexto}>{p.texto}</Text>
              <View style={styles.opciones}>
                {([['Sí', true], ['No', false]] as const).map(([label, valor]) => (
                  <TouchableOpacity
                    key={label}
                    style={[styles.opcion, respuestas[p.id] === valor && styles.opcionActiva]}
                    onPress={() => setRespuestas(prev => ({ ...prev, [p.id]: valor }))}
                  >
                    <Text style={[styles.opcionText, respuestas[p.id] === valor && styles.opcionTextActiva]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        ))}

        <Text style={styles.comentarioLabel}>¿ALGO MÁS QUE TU COACH DEBA SABER? (OPCIONAL)</Text>
        <TextInput
          style={styles.comentario}
          value={comentario}
          onChangeText={setComentario}
          placeholder="Lesiones previas, operaciones, alergias…"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={600}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.guardar, (!completo || guardando) && styles.guardarInactivo]}
          onPress={guardar}
          disabled={!completo || guardando}
          activeOpacity={0.85}
        >
          <Text style={styles.guardarText}>
            {guardando ? 'GUARDANDO…' : completo ? 'GUARDAR MI FICHA' : `RESPONDE LAS ${PARQ_PREGUNTAS.length} PREGUNTAS`}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 56 },
  volver: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  titulo: { fontFamily: fonts.display, color: colors.textPrimary, fontSize: 34, marginTop: spacing.md },
  sub: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: spacing.lg },
  pregunta: {
    flexDirection: 'row', gap: 12, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.card, padding: spacing.md,
  },
  preguntaNum: { fontFamily: fonts.mono, color: colors.textMuted, fontSize: 14 },
  preguntaTexto: { color: colors.textPrimary, fontSize: 13.5, lineHeight: 19 },
  opciones: { flexDirection: 'row', gap: 8, marginTop: 10 },
  opcion: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 99,
    paddingVertical: 6, paddingHorizontal: 20,
  },
  opcionActiva: { backgroundColor: colors.accent, borderColor: colors.accent },
  opcionText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  opcionTextActiva: { color: colors.background },
  comentarioLabel: {
    color: colors.textMuted, fontSize: 10, fontWeight: '800',
    letterSpacing: 1.5, marginTop: spacing.sm, marginBottom: 6,
  },
  comentario: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    color: colors.textPrimary, padding: spacing.md, fontSize: 14,
    minHeight: 80, textAlignVertical: 'top', backgroundColor: colors.card,
  },
  error: { color: colors.textSecondary, fontSize: 12, marginTop: spacing.sm },
  guardar: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: spacing.lg,
  },
  guardarInactivo: { opacity: 0.4 },
  guardarText: { color: colors.background, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
});
