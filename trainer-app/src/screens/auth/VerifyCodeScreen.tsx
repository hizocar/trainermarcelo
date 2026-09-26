import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Pantalla, Titulo, Campo, BotonPrimario, Enlace, TextoError, stylesIngreso } from '../../components/auth/ui';
import { verificarCodigo, reenviarCodigo } from '../../lib/ingreso';

// El código de 6 dígitos que llega al correo. Se usa código y no enlace porque
// los enlaces de verificación suelen abrirse en el navegador y no en la app.
export default function VerifyCodeScreen() {
  const navigation = useNavigation<any>();
  const { correo } = useRoute<any>().params as { correo: string };
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [espera, setEspera] = useState(60);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  async function verificar() {
    setError('');
    if (!/^\d{6}$/.test(codigo.trim())) { setError('El código tiene 6 dígitos.'); return; }
    setCargando(true);
    const e = await verificarCodigo(correo, codigo);
    setCargando(false);
    if (e) setError(e);
    // si no hubo error, hay sesión: la navegación sigue sola
  }

  async function reenviar() {
    setError('');
    const e = await reenviarCodigo(correo);
    if (e) setError(e);
    else setEspera(60);
  }

  return (
    <Pantalla>
      <Titulo kicker="VERIFICA TU CORREO" titulo="REVISA TU CORREO" sub={`Te mandamos un código de 6 dígitos a ${correo}.`} />
      <View style={stylesIngreso.grupo}>
        <Campo etiqueta="CÓDIGO" value={codigo} onChangeText={(t) => setCodigo(t.replace(/\D/g, '').slice(0, 6))}
          placeholder="123456" keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode"
          maxLength={6} autoFocus onSubmitEditing={verificar} />
        {error ? <TextoError>{error}</TextoError> : null}
        <BotonPrimario texto="VERIFICAR" onPress={verificar} cargando={cargando} />
        {espera > 0
          ? <Enlace texto={`¿NO LLEGÓ? PIDE OTRO EN ${espera} S`} onPress={() => {}} />
          : <Enlace texto="¿NO LLEGÓ? PEDIR OTRO CÓDIGO" onPress={reenviar} />}
        <Enlace texto="VOLVER" onPress={() => navigation.goBack()} />
      </View>
    </Pantalla>
  );
}
