import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { colors, spacing, radius, typography } from '../../theme';
import { Pantalla, Titulo, Campo, BotonPrimario, Enlace, TextoError, stylesIngreso } from '../../components/auth/ui';
import { validarNombre, nombreEsCorreo } from '../../lib/registro';
import { tomarNombreSugerido } from '../../lib/ingreso';

// La pantalla obligatoria de toda cuenta nueva (v49): cómo va a usar la app y
// su nombre. completar_registro lo fija UNA sola vez en el servidor; si elige
// entrenador, ahí mismo nace su prueba de 3 meses con hasta 5 alumnos.
type Rol = 'alumno' | 'coach';

const OPCIONES: { rol: Rol; icono: keyof typeof Ionicons.glyphMap; titulo: string; detalle: string }[] = [
  { rol: 'alumno', icono: 'barbell-outline', titulo: 'QUIERO ENTRENAR', detalle: 'Con un coach o por mi cuenta' },
  { rol: 'coach', icono: 'clipboard-outline', titulo: 'SOY ENTRENADOR', detalle: 'Para armar planes y guiar a mis alumnos' },
];

export default function OnboardingScreen() {
  const { user, refreshProfile, signOut } = useAuth();
  const inicial = tomarNombreSugerido() ?? (user?.name && !nombreEsCorreo(user.name) ? user.name : '');
  const [rol, setRol] = useState<Rol | null>(null);
  const [nombre, setNombre] = useState(inicial);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function continuar() {
    setError('');
    if (!rol) { setError('Elige cómo vas a usar EliteFitness.'); return; }
    const e = validarNombre(nombre);
    if (e) { setError(e); return; }
    setCargando(true);
    const { error: rpcErr } = await supabase.rpc('completar_registro', { p_rol: rol, p_nombre: nombre.trim() });
    // ya completo (otro dispositivo, doble toque): igual se sigue
    if (rpcErr && rpcErr.message !== 'registro_ya_completo') {
      setCargando(false);
      setError(rpcErr.message.includes('Failed to fetch') || rpcErr.message.includes('Network')
        ? 'El registro necesita conexión. Revisa tu señal e inténtalo de nuevo.'
        : rpcErr.message);
      return;
    }
    await refreshProfile();
    setCargando(false);
  }

  return (
    <Pantalla>
      <Titulo kicker="BIENVENIDA" titulo="¿CÓMO VAS A USAR ELITEFITNESS?" />
      <View style={styles.opciones}>
        {OPCIONES.map((o) => {
          const activa = rol === o.rol;
          return (
            <TouchableOpacity
              key={o.rol}
              style={[styles.opcion, activa && styles.opcionActiva]}
              onPress={() => setRol(o.rol)}
              activeOpacity={0.85}
              accessibilityRole="radio"
              accessibilityState={{ selected: activa }}
              accessibilityLabel={`${o.titulo}: ${o.detalle}`}
            >
              <Ionicons name={o.icono} size={24} color={activa ? colors.accent : colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.opcionTitulo, activa && { color: colors.textPrimary }]}>{o.titulo}</Text>
                <Text style={styles.opcionDetalle}>{o.detalle}</Text>
              </View>
              {activa && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={stylesIngreso.grupo}>
        <Campo etiqueta="¿CÓMO TE LLAMAS?" value={nombre} onChangeText={setNombre} placeholder="Camila Rojas"
          autoComplete="name" textContentType="name" maxLength={60}
          ayuda={rol === 'coach' ? 'Lo ven tus alumnos y quienes buscan coach.' : 'Lo ve tu coach.'} />
        {rol === 'coach' && (
          <Text style={styles.nota}>3 meses gratis, con hasta 5 alumnos. Sin tarjeta.</Text>
        )}
        {error ? <TextoError>{error}</TextoError> : null}
        <BotonPrimario texto="CONTINUAR" onPress={continuar} cargando={cargando} />
        <Enlace texto="NO SOY YO · SALIR" onPress={signOut} />
      </View>
    </Pantalla>
  );
}

const styles = StyleSheet.create({
  opciones: { gap: spacing.sm, marginBottom: spacing.md },
  opcion: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, borderRadius: radius.md, borderCurve: 'continuous',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  opcionActiva: { borderColor: colors.accent },
  opcionTitulo: { ...typography.label, color: colors.textSecondary, letterSpacing: 2 },
  opcionDetalle: { ...typography.caption, marginTop: 2 },
  nota: { ...typography.caption, color: colors.textSecondary },
});
