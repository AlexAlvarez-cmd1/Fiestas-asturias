import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { authService } from '../../services/authService';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Faltan datos', 'Introduce email y contraseña');
    setCargando(true);
    try {
      await authService.loginWithEmail(email.trim(), password);
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error login:', error.code, error.message);
      Alert.alert('Error al entrar', traducirError(error.code));
    } finally {
      setCargando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>⛺</Text>
        <Text style={styles.titulo}>Folixa</Text>
        <Text style={styles.subtitulo}>Entra para ver las fiestas</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#888"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor="#888"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.btnLogin} onPress={handleLogin} disabled={cargando}>
          {cargando
            ? <ActivityIndicator color="#1a1a1a" />
            : <Text style={styles.btnLoginTexto}>Entrar</Text>
          }
        </TouchableOpacity>

        <View style={styles.separador}>
          <View style={styles.linea} />
          <Text style={styles.textoSeparador}>o</Text>
          <View style={styles.linea} />
        </View>

        <TouchableOpacity
          style={styles.btnGoogle}
          onPress={() => Alert.alert('Próximamente', 'El acceso con Google se activará en la próxima actualización.')}
        >
          <Text style={styles.btnGoogleTexto}>🔵  Continuar con Google</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/auth/registro')} style={styles.linkRegistro}>
          <Text style={styles.textoLink}>¿No tienes cuenta? <Text style={styles.textoLinkBold}>Regístrate</Text></Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function traducirError(code) {
  const errores = {
    'auth/user-not-found': 'Email o contraseña incorrectos.',
    'auth/wrong-password': 'Email o contraseña incorrectos.',
    'auth/invalid-email': 'El email no es válido.',
    'auth/too-many-requests': 'Demasiados intentos. Espera un momento.',
    'auth/invalid-credential': 'Email o contraseña incorrectos. Si no tienes cuenta, regístrate.',
  };
  return errores[code] || 'Error desconocido. Inténtalo de nuevo.';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#166534' },
  inner: { flex: 1, justifyContent: 'center', padding: 30 },
  logo: { fontSize: 70, textAlign: 'center' },
  titulo: { fontSize: 38, fontWeight: 'bold', color: 'white', textAlign: 'center', marginTop: 8 },
  subtitulo: { fontSize: 16, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 35, marginTop: 6 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14, padding: 16, fontSize: 16,
    color: 'white', marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  btnLogin: {
    backgroundColor: '#F59E0B', borderRadius: 14, padding: 16,
    alignItems: 'center', marginTop: 6,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.2,
  },
  btnLoginTexto: { color: '#1a1a1a', fontWeight: 'bold', fontSize: 17 },
  separador: { flexDirection: 'row', alignItems: 'center', marginVertical: 22 },
  linea: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  textoSeparador: { color: 'rgba(255,255,255,0.6)', marginHorizontal: 12, fontSize: 14 },
  btnGoogle: {
    backgroundColor: 'white', borderRadius: 14, padding: 16,
    alignItems: 'center', elevation: 2, opacity: 0.6,
  },
  btnGoogleTexto: { color: '#333', fontWeight: '600', fontSize: 16 },
  linkRegistro: { marginTop: 24, alignItems: 'center' },
  textoLink: { color: 'rgba(255,255,255,0.7)', fontSize: 15 },
  textoLinkBold: { color: 'white', fontWeight: 'bold' },
});
