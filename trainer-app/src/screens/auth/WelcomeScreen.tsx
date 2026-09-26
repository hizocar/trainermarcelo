import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ImageBackground, StatusBar, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { colors, spacing, radius, typography } from '../../theme';
import { BotonPrimario, BotonSecundario, TextoError } from '../../components/auth/ui';
import {
  leerProveedores, ingresarConApple, ingresarConGoogle, guardarNombreSugerido, type Proveedores,
} from '../../lib/ingreso';

// Primera pantalla sin sesión (registro propio, v49). Apple y Google sirven
// igual para crear cuenta o entrar; si la cuenta es nueva, la navegación lleva
// sola a la pantalla obligatoria de rol y nombre.
export default function WelcomeScreen() {
  const navigation = useNavigation<any>();
  const [prov, setProv] = useState<Proveedores>({ google: false, apple: false, verificaCorreo: false });
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => { leerProveedores().then(setProv); }, []);

  async function conApple() {
    setError('');
    setOcupado(true);
    const r = await ingresarConApple();
    setOcupado(false);
    if (r.error) setError(r.error);
    else guardarNombreSugerido(r.nombre);
  }

  async function conGoogle() {
    setError('');
    setOcupado(true);
    const e = await ingresarConGoogle();
    setOcupado(false);
    if (e) setError(e);
  }

  return (
    <ImageBackground source={require('../../../assets/hero-marcelo.jpg')} style={styles.hero} resizeMode="cover">
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['rgba(0,3,13,0.25)', 'rgba(0,3,13,0.75)', '#00030D']}
        locations={[0, 0.5, 0.85]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.contenido}>
        <View style={styles.cabecera}>
          <View style={styles.marcaFila}>
            <View style={styles.marcaBarra} />
            <Text style={styles.kicker}>ENTRENAMIENTO PERSONALIZADO</Text>
          </View>
          <Text style={styles.logo}>ELITE</Text>
          <Text style={styles.logoAcento}>FITNESS</Text>
          <Text style={styles.sub}>Entrena con tu coach o arma tu propia rutina.</Text>
        </View>

        <View style={styles.botones}>
          {prov.apple && Platform.OS === 'ios' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={radius.md}
              style={styles.apple}
              onPress={conApple}
            />
          )}
          {prov.google && <BotonSecundario texto="CONTINUAR CON GOOGLE" onPress={conGoogle} deshabilitado={ocupado} />}
          <BotonPrimario texto="CREAR CUENTA" onPress={() => navigation.navigate('SignUp')} deshabilitado={ocupado} />
          <BotonSecundario texto="YA TENGO CUENTA" onPress={() => navigation.navigate('Login')} deshabilitado={ocupado} />
          {error ? <TextoError>{error}</TextoError> : null}
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, backgroundColor: colors.background },
  contenido: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.xl },
  cabecera: { gap: 2 },
  marcaFila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  marcaBarra: { width: 28, height: 3, backgroundColor: colors.accent, borderRadius: radius.full },
  kicker: { ...typography.label, color: colors.textSecondary, letterSpacing: 3, fontSize: 10 },
  logo: { ...typography.display, fontSize: 46, lineHeight: 58, color: colors.textPrimary },
  logoAcento: { ...typography.display, fontSize: 46, lineHeight: 58, color: colors.accent },
  sub: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
  botones: { gap: spacing.sm },
  apple: { height: 52, width: '100%' },
});
