import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Pantalla, Titulo, Campo, BotonPrimario, Enlace, TextoError, stylesIngreso } from '../../components/auth/ui';
import { registrarConCorreo } from '../../lib/ingreso';
import { View } from 'react-native';

// Crear cuenta con correo y clave. Si la verificación está encendida, sigue la
// pantalla del código; si no, la sesión llega al tiro y la navegación lleva a
// la pantalla obligatoria de rol y nombre.
export default function SignUpScreen() {
  const navigation = useNavigation<any>();
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [existe, setExiste] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function crear() {
    setError('');
    setExiste(false);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo.trim())) { setError('Revisa tu correo.'); return; }
    if (clave.length < 8) { setError('La clave necesita al menos 8 caracteres.'); return; }
    setCargando(true);
    const r = await registrarConCorreo(correo, clave);
    setCargando(false);
    if (r.tipo === 'codigo') navigation.navigate('VerifyCode', { correo: correo.trim().toLowerCase() });
    else if (r.tipo === 'existe') setExiste(true);
    else if (r.tipo === 'error') setError(r.mensaje);
    // 'listo': la sesión cambió y la navegación sigue sola
  }

  return (
    <Pantalla>
      <Titulo kicker="CREAR CUENTA" titulo="EMPECEMOS" sub="Con tu correo y una clave. Después eliges cómo vas a usar la app." />
      <View style={stylesIngreso.grupo}>
        <Campo etiqueta="CORREO" value={correo} onChangeText={setCorreo} placeholder="tu@correo.com"
          keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" />
        <Campo etiqueta="CLAVE" value={clave} onChangeText={setClave} placeholder="Mínimo 8 caracteres"
          secureTextEntry autoComplete="new-password" textContentType="newPassword" onSubmitEditing={crear} />
        {existe ? <TextoError>Ese correo ya tiene una cuenta. Inicia sesión.</TextoError> : null}
        {error ? <TextoError>{error}</TextoError> : null}
        <BotonPrimario texto="CREAR CUENTA" onPress={crear} cargando={cargando} />
        {existe && <Enlace texto="INICIAR SESIÓN" onPress={() => navigation.navigate('Login')} />}
        <Enlace texto="VOLVER" onPress={() => navigation.goBack()} />
      </View>
    </Pantalla>
  );
}
