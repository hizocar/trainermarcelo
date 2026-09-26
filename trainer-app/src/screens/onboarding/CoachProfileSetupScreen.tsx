import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { pickImage, uploadMedia } from '../../lib/media';
import { colors, spacing, radius, typography } from '../../theme';
import { Pantalla, Titulo, Campo, BotonPrimario, Enlace, TextoError, stylesIngreso } from '../../components/auth/ui';
import { faltantesPerfil, validarNombre } from '../../lib/registro';

// Perfil de coach OBLIGATORIO (v49): lo ven sus alumnos al abrir su perfil.
// "Aparecer en el buscador" es opcional (encendido por defecto): encendido
// entra a la cola de aprobación de Sebastián; apagado solo lo ven sus alumnos.
// La regla de "completo" es la misma de la base (users.perfil_coach_completo).

const MODALIDADES: { valor: string; etiqueta: string }[] = [
  { valor: 'online', etiqueta: 'Online' },
  { valor: 'gimnasio', etiqueta: 'En gimnasio' },
  { valor: 'domicilio', etiqueta: 'A domicilio' },
];

const lista = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export default function CoachProfileSetupScreen() {
  const { user, refreshProfile, signOut } = useAuth();
  const [foto, setFoto] = useState<string | null>(user?.avatar_url ?? null);
  const [subiendo, setSubiendo] = useState(false);
  const [nombre, setNombre] = useState(user?.name && !user.name.includes('@') ? user.name : '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [especialidades, setEspecialidades] = useState((user?.specialties ?? []).join(', '));
  const [servicios, setServicios] = useState<string[]>(user?.services ?? []);
  const [comunas, setComunas] = useState((user?.comunas ?? []).join(', '));
  const [instagram, setInstagram] = useState(user?.instagram ?? '');
  const [enBuscador, setEnBuscador] = useState(user?.en_buscador ?? true);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const presencial = servicios.some((s) => s === 'gimnasio' || s === 'domicilio');

  async function elegirFoto() {
    if (!user) return;
    setError('');
    const asset = await pickImage();
    if (!asset) return;
    setSubiendo(true);
    try {
      // la primera carpeta es el uid: es lo que exige la política de avatars
      const url = await uploadMedia('avatars', `${user.id}/avatar-${Date.now()}.jpg`, asset);
      const { error: updErr } = await supabase.from('users').update({ avatar_url: url }).eq('id', user.id);
      if (updErr) throw new Error(updErr.message);
      setFoto(url);
    } catch {
      setError('No se pudo subir la foto. Revisa tu señal e inténtalo de nuevo.');
    } finally {
      setSubiendo(false);
    }
  }

  function alternar(valor: string) {
    setServicios((prev) => (prev.includes(valor) ? prev.filter((v) => v !== valor) : [...prev, valor]));
  }

  async function guardar() {
    setError('');
    const eNombre = validarNombre(nombre);
    if (eNombre) { setError(eNombre); return; }
    const falta = faltantesPerfil({
      avatar_url: foto, bio, specialties: lista(especialidades), services: servicios, comunas: lista(comunas),
    });
    if (falta.length) { setError(`Falta: ${falta.join(', ')}.`); return; }
    if (lista(especialidades).length > 6) { setError('Máximo 6 especialidades.'); return; }
    if (lista(comunas).length > 10) { setError('Máximo 10 comunas.'); return; }

    setGuardando(true);
    const { error: rpcErr } = await supabase.rpc('update_my_profile', {
      p_bio: bio, p_instagram: instagram,
      p_specialties: lista(especialidades), p_comunas: presencial ? lista(comunas) : [],
      p_services: servicios, p_accepting: true, p_name: nombre.trim(), p_en_buscador: enBuscador,
    });
    if (rpcErr) { setGuardando(false); setError(rpcErr.message); return; }
    await refreshProfile();
    setGuardando(false);
  }

  return (
    <Pantalla>
      <Titulo kicker="UN PASO MÁS" titulo="TU PERFIL DE COACH" sub="Es lo que ven tus alumnos al abrir tu perfil." />
      <View style={stylesIngreso.grupo}>
        <TouchableOpacity style={styles.fotoFila} onPress={elegirFoto} disabled={subiendo} activeOpacity={0.8}
          accessibilityRole="button" accessibilityLabel={foto ? 'Cambiar tu foto' : 'Subir tu foto'}>
          <View style={styles.foto}>
            {subiendo ? <ActivityIndicator color={colors.textMuted} />
              : foto ? <Image source={{ uri: foto }} style={styles.fotoImg} />
              : <Ionicons name="camera-outline" size={24} color={colors.textMuted} />}
          </View>
          <Text style={styles.fotoTexto}>{foto ? 'CAMBIAR FOTO' : 'SUBIR TU FOTO'}</Text>
        </TouchableOpacity>

        <Campo etiqueta="TU NOMBRE" value={nombre} onChangeText={setNombre} placeholder="Camila Rojas" maxLength={60} autoComplete="name" />
        <Campo etiqueta="SOBRE TI" value={bio} onChangeText={setBio} placeholder="Cómo trabajas, con quién, desde cuándo."
          multiline maxLength={800} />
        <Campo etiqueta="ESPECIALIDADES" value={especialidades} onChangeText={setEspecialidades}
          placeholder="Fuerza, Pérdida de grasa" ayuda="Separadas por coma. Al menos una." />

        <Text style={styles.etiqueta}>¿CÓMO ENTRENAS?</Text>
        <View style={styles.chips}>
          {MODALIDADES.map((m) => {
            const activo = servicios.includes(m.valor);
            return (
              <TouchableOpacity key={m.valor} style={[styles.chip, activo && styles.chipActivo]} onPress={() => alternar(m.valor)}
                accessibilityRole="checkbox" accessibilityState={{ checked: activo }} accessibilityLabel={m.etiqueta}>
                <Text style={[styles.chipTexto, activo && { color: colors.textPrimary }]}>{m.etiqueta}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {presencial && (
          <Campo etiqueta="COMUNAS" value={comunas} onChangeText={setComunas} placeholder="Ñuñoa, Providencia"
            ayuda="Donde atiendes en persona. Separadas por coma." />
        )}
        <Campo etiqueta="INSTAGRAM (OPCIONAL)" value={instagram} onChangeText={setInstagram} placeholder="tu_usuario" autoCapitalize="none" />

        <View style={styles.buscador}>
          <View style={{ flex: 1 }}>
            <Text style={styles.buscadorTitulo}>APARECER EN EL BUSCADOR</Text>
            <Text style={styles.buscadorTexto}>
              Los alumnos que buscan coach te encuentran. Revisamos tu perfil antes de mostrarlo. Apagado, solo te ven tus alumnos.
            </Text>
          </View>
          <Switch value={enBuscador} onValueChange={setEnBuscador}
            trackColor={{ false: colors.border, true: colors.accent }} thumbColor={colors.textPrimary} />
        </View>

        {error ? <TextoError>{error}</TextoError> : null}
        <BotonPrimario texto="GUARDAR Y ENTRAR" onPress={guardar} cargando={guardando} deshabilitado={subiendo} />
        <Enlace texto="SALIR" onPress={signOut} />
      </View>
    </Pantalla>
  );
}

const styles = StyleSheet.create({
  fotoFila: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  foto: {
    width: 72, height: 72, borderRadius: 36, overflow: 'hidden',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  fotoImg: { width: '100%', height: '100%' },
  fotoTexto: { ...typography.label, color: colors.textPrimary, letterSpacing: 2 },
  etiqueta: { ...typography.label, letterSpacing: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  chipActivo: { borderColor: colors.accent },
  chipTexto: { ...typography.label, color: colors.textMuted, letterSpacing: 1 },
  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, borderRadius: radius.md, borderCurve: 'continuous',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  buscadorTitulo: { ...typography.label, color: colors.textPrimary, letterSpacing: 1.5 },
  buscadorTexto: { ...typography.caption, marginTop: 2 },
});
