import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Modal, Alert, Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius, fonts } from '../../theme';
import { WEEK_DAYS, getCurrentWeek } from '../../lib/weeks';
import { track } from '../../lib/analytics';

// La rutina propia: el cliente SIN coach arma su plan él mismo.
//
// A propósito NO es el editor del coach: acá no hay superseries, tempo, RIR,
// videos ni gestión de semanas. El cliente pone sus días, les coloca
// ejercicios de la biblioteca (3 series de 8-12 por defecto) y va a entrenar.
// Todo lo demás —Hoy, registro, cronómetro, historial— funciona igual porque
// el plan es EL MISMO modelo de datos, con él como dueño.
//
// La regla "un cliente con coach no edita su rutina" no vive acá: la impone
// la base (v30). Esta pantalla solo existe en la navegación del cliente sin
// coach; si un coach lo toma, el plan pasa a manos del coach solo.

interface DiaPropio {
  id: string;
  name: string;
  week_day: number | null;
  exercises: { id: string; name: string }[];
}

interface Sugerencia { id: string; name: string; muscle_group: string; equipment: string | null }

export default function MyRoutineScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [planId, setPlanId] = useState<string | null>(null);
  const [weekId, setWeekId] = useState<string | null>(null);
  const [dias, setDias] = useState<DiaPropio[]>([]);
  const [guardando, setGuardando] = useState(false);

  const [showDia, setShowDia] = useState(false);
  const [nombreDia, setNombreDia] = useState('');
  const [weekDay, setWeekDay] = useState(1);

  const [diaAbierto, setDiaAbierto] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);

  const cargar = useCallback(async () => {
    if (!user) return;
    const { data: plan } = await supabase
      .from('workout_plans').select('id').eq('client_id', user.id).maybeSingle();
    if (!plan) { setPlanId(null); setDias([]); setLoading(false); return; }
    setPlanId(plan.id);

    const { data: weeks } = await supabase
      .from('plan_weeks').select('id').eq('plan_id', plan.id)
      .eq('archived', false).order('week_number').limit(1);
    const w = weeks?.[0]?.id ?? null;
    setWeekId(w);

    const { data: days } = await supabase
      .from('training_days')
      .select('id, name, week_day, archived, exercises ( id, name, archived, order_index )')
      .eq('plan_id', plan.id)
      .order('day_number');
    setDias((days ?? [])
      .filter((d: any) => !d.archived)
      .map((d: any) => ({
        id: d.id, name: d.name, week_day: d.week_day,
        exercises: (d.exercises ?? [])
          .filter((e: any) => !e.archived)
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .map((e: any) => ({ id: e.id, name: e.name })),
      })));
    setLoading(false);
  }, [user?.id]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  // El plan y su única semana nacen juntos, la primera vez. repeat_forever:
  // la rutina propia no gestiona semanas — es la misma para siempre hasta
  // que el cliente la cambie.
  async function crearRutina() {
    if (guardando || !user) return;
    setGuardando(true);
    const { data: plan, error } = await supabase
      .from('workout_plans')
      .insert({ client_id: user.id, name: 'Mi rutina', created_by: user.id })
      .select('id').single();
    if (error || !plan) { setGuardando(false); return; }
    const { data: week } = await supabase
      .from('plan_weeks')
      .insert({ plan_id: plan.id, week_number: getCurrentWeek(), name: 'Mi rutina', repeat_forever: true })
      .select('id').single();
    setPlanId(plan.id);
    setWeekId(week?.id ?? null);
    setGuardando(false);
    track('rutina_propia_creada', {});
  }

  async function agregarDia() {
    if (!planId || !weekId || !nombreDia.trim() || guardando) return;
    setGuardando(true);
    const { data: dia, error } = await supabase
      .from('training_days')
      .insert({
        plan_id: planId, plan_week_id: weekId, day_number: dias.length + 1,
        name: nombreDia.trim(), week_day: weekDay,
      })
      .select('id, name, week_day').single();
    setGuardando(false);
    if (error || !dia) return;
    setDias(prev => [...prev, { id: dia.id, name: dia.name, week_day: dia.week_day, exercises: [] }]);
    setNombreDia(''); setWeekDay(1); setShowDia(false);
    setDiaAbierto(dia.id);
    track('rutina_dia_agregado', { week_day: dia.week_day });
  }

  function eliminarDia(dia: DiaPropio) {
    const borrar = async () => {
      await supabase.from('training_days').update({ archived: true }).eq('id', dia.id);
      setDias(prev => prev.filter(d => d.id !== dia.id));
    };
    if (Platform.OS === 'web') { borrar(); return; }
    Alert.alert('Eliminar día', `"${dia.name}" se quitará de tu rutina. Tu historial se conserva.`,
      [{ text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: borrar }]);
  }

  async function buscar(texto: string) {
    setBusqueda(texto);
    if (texto.trim().length < 2) { setSugerencias([]); return; }
    const { data } = await supabase
      .from('exercise_library')
      .select('id, name, muscle_group, equipment')
      .ilike('name', `%${texto.trim()}%`)
      .limit(8);
    setSugerencias(data ?? []);
  }

  // Colocar un ejercicio "y ya": 3 series de 8-12, sin más preguntas.
  async function agregarEjercicio(diaId: string, s: Sugerencia) {
    if (guardando) return;
    setGuardando(true);
    const dia = dias.find(d => d.id === diaId);
    const { data: ex, error } = await supabase
      .from('exercises')
      .insert({
        day_id: diaId, name: s.name, muscle_group: s.muscle_group,
        library_id: s.id, reps_objective: '8-12', unit: 'kg',
        superseries_group: null, order_index: dia?.exercises.length ?? 0,
      })
      .select('id, name').single();
    if (!error && ex) {
      await supabase.from('exercise_series').insert(
        Array.from({ length: 3 }, (_, i) => ({ exercise_id: ex.id, series_number: i + 1 })),
      );
      setDias(prev => prev.map(d =>
        d.id === diaId ? { ...d, exercises: [...d.exercises, { id: ex.id, name: ex.name }] } : d));
      track('rutina_ejercicio_agregado', { nombre: s.name });
    }
    setBusqueda(''); setSugerencias([]);
    setGuardando(false);
  }

  async function quitarEjercicio(diaId: string, exId: string) {
    await supabase.from('exercises').update({ archived: true }).eq('id', exId);
    setDias(prev => prev.map(d =>
      d.id === diaId ? { ...d, exercises: d.exercises.filter(e => e.id !== exId) } : d));
  }

  if (loading) return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.accent} style={{ marginTop: 100 }} />
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.volver}>← VOLVER</Text>
        </TouchableOpacity>

        <Text style={styles.titulo}>MI RUTINA</Text>
        <Text style={styles.sub}>
          Armada por ti: elige tus días y colócales ejercicios. Cada uno parte
          con 3 series de 8 a 12 — el peso lo registras al entrenar, como siempre.
        </Text>

        {!planId ? (
          <TouchableOpacity style={styles.crear} onPress={crearRutina} disabled={guardando} activeOpacity={0.85}>
            <Text style={styles.crearText}>{guardando ? 'CREANDO…' : 'CREAR MI RUTINA'}</Text>
          </TouchableOpacity>
        ) : (
          <>
            {dias.map(dia => (
              <View key={dia.id} style={styles.dia}>
                <TouchableOpacity
                  style={styles.diaHead}
                  onPress={() => setDiaAbierto(diaAbierto === dia.id ? null : dia.id)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.diaNombre}>{dia.name.toUpperCase()}</Text>
                    <Text style={styles.diaMeta}>
                      {dia.week_day != null ? WEEK_DAYS[dia.week_day] : 'Sin día'} · {dia.exercises.length} ejercicio{dia.exercises.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => eliminarDia(dia)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                </TouchableOpacity>

                {diaAbierto === dia.id && (
                  <View style={styles.diaCuerpo}>
                    {dia.exercises.map(e => (
                      <View key={e.id} style={styles.ejercicio}>
                        <Text style={styles.ejercicioNombre}>{e.name}</Text>
                        <TouchableOpacity onPress={() => quitarEjercicio(dia.id, e.id)}
                                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="close" size={14} color={colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    ))}

                    <TextInput
                      style={styles.buscador}
                      value={busqueda}
                      onChangeText={buscar}
                      placeholder="Busca un ejercicio: press, remo, sentadilla…"
                      placeholderTextColor={colors.textMuted}
                    />
                    {sugerencias.map(s => (
                      <TouchableOpacity key={s.id} style={styles.sugerencia}
                                        onPress={() => agregarEjercicio(dia.id, s)} disabled={guardando}>
                        <Text style={styles.sugerenciaNombre}>{s.name}</Text>
                        <Text style={styles.sugerenciaMeta}>
                          {s.muscle_group}{s.equipment ? ` · ${s.equipment}` : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))}

            <TouchableOpacity style={styles.agregarDia} onPress={() => setShowDia(true)}>
              <Text style={styles.agregarDiaText}>+ AGREGAR DÍA</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <Modal visible={showDia} transparent animationType="fade" onRequestClose={() => setShowDia(false)}>
        <View style={styles.modalFondo}>
          <View style={styles.modal}>
            <Text style={styles.modalTitulo}>NUEVO DÍA</Text>
            <TextInput
              style={styles.buscador}
              value={nombreDia}
              onChangeText={setNombreDia}
              placeholder="ej: Full body, Torso, Pierna"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <View style={styles.diasSemana}>
              {WEEK_DAYS.map((d, i) => (
                <TouchableOpacity key={i}
                  style={[styles.chipDia, weekDay === i && styles.chipDiaActivo]}
                  onPress={() => setWeekDay(i)}>
                  <Text style={[styles.chipDiaText, weekDay === i && styles.chipDiaTextActivo]}>{d.slice(0, 3)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: spacing.lg }}>
              <TouchableOpacity style={styles.crear} onPress={agregarDia} disabled={guardando || !nombreDia.trim()}>
                <Text style={styles.crearText}>AGREGAR</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowDia(false)} style={{ justifyContent: 'center' }}>
                <Text style={styles.volver}>CANCELAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 56 },
  volver: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  titulo: { fontFamily: fonts.display, color: colors.textPrimary, fontSize: 34, marginTop: spacing.md },
  sub: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: spacing.lg },
  crear: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: 12, paddingHorizontal: 24, alignSelf: 'flex-start',
  },
  crearText: { color: colors.background, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  dia: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.card, marginBottom: spacing.sm, overflow: 'hidden',
  },
  diaHead: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: 10 },
  diaNombre: { fontFamily: fonts.display, color: colors.textPrimary, fontSize: 16, letterSpacing: 0.5 },
  diaMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  diaCuerpo: { borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md, gap: 8 },
  ejercicio: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 6,
  },
  ejercicioNombre: { color: colors.textPrimary, fontSize: 14 },
  buscador: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    color: colors.textPrimary, paddingVertical: 8, paddingHorizontal: 12,
    fontSize: 14, backgroundColor: colors.background, marginTop: 4,
  },
  sugerencia: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  sugerenciaNombre: { color: colors.textPrimary, fontSize: 14 },
  sugerenciaMeta: { color: colors.textMuted, fontSize: 11, marginTop: 1 },
  agregarDia: {
    borderWidth: 1, borderColor: colors.borderLight, borderStyle: 'dashed',
    borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: spacing.sm,
  },
  agregarDiaText: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  modalFondo: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center', padding: spacing.xl,
  },
  modal: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.lg,
  },
  modalTitulo: { fontFamily: fonts.display, color: colors.textPrimary, fontSize: 18, marginBottom: spacing.sm },
  diasSemana: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md },
  chipDia: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 99,
    paddingVertical: 6, paddingHorizontal: 12,
  },
  chipDiaActivo: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipDiaText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
  chipDiaTextActivo: { color: colors.background },
});
