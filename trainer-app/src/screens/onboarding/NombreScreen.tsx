import React, { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Pantalla, Titulo, Campo, BotonPrimario, TextoError, stylesIngreso } from '../../components/auth/ui';
import { validarNombre } from '../../lib/registro';

// Para cuentas cuyo nombre quedó como su correo (le pasó a Yharel): se pide
// el nombre una sola vez y listo.
export default function NombreScreen() {
  const { refreshProfile } = useAuth();
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function guardar() {
    setError('');
    const e = validarNombre(nombre);
    if (e) { setError(e); return; }
    setCargando(true);
    const { error: rpcErr } = await supabase.rpc('actualizar_mi_nombre', { p_nombre: nombre.trim() });
    if (rpcErr) { setCargando(false); setError(rpcErr.message); return; }
    await refreshProfile();
    setCargando(false);
  }

  return (
    <Pantalla>
      <Titulo kicker="UN DETALLE" titulo="¿CÓMO TE LLAMAS?" sub="Tu cuenta tiene tu correo como nombre. Así lo ve tu coach." />
      <View style={stylesIngreso.grupo}>
        <Campo etiqueta="TU NOMBRE" value={nombre} onChangeText={setNombre} placeholder="Camila Rojas"
          autoComplete="name" textContentType="name" maxLength={60} autoFocus onSubmitEditing={guardar} />
        {error ? <TextoError>{error}</TextoError> : null}
        <BotonPrimario texto="GUARDAR" onPress={guardar} cargando={cargando} />
      </View>
    </Pantalla>
  );
}
