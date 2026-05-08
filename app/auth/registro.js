import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { authService } from '../../services/authService';

export default function Registro() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleRegistro = async () => {
    if (!username || !email || !password) {
      return Alert.alert('Faltan datos', 'Rellena todos los campos');
    }
    if (username.length < 3) {
      return Alert.alert('Username muy corto', 'Mínimo 3 caracteres');
    }
    if (password !== password2) {
      return Alert.alert('Contraseñas distintas', 'Las contraseñas no coinciden');
    }
    if (password.length < 6) {
      return Alert.alert('Contraseña corta', 'Mínimo 6 caracteres');
    }

    setCargando(true);
    try {
      await authService.registerWithEmail(email.trim(), password, username.trim());
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error registro:', error.code, error.message);
      Alert.alert('Error al registrarse', `${traducirError(error.code)}\n\nCódigo: ${error.code || error.message}`);
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
        <TouchableOpacity onPress={() => router.back()} style={styles.btnVolver}>
          <Text style={styles.textoVolver}>← Volver</Text>
        </TouchableOpacity>

        <Text style={styles.titulo}>Crear cuenta</Text>
        <Text style={styles.subtitulo}>Únete a la comunidad Folixa</Text>

        <TextInput
          style={styles.input}
          placeholder="Nombre de usuario"
          placeholderTextColor="#888"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
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
          placeholder="Contraseña (mín. 6 caracteres)"
          placeholderTextColor="#888"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          placeholder="Repetir contraseña"
          placeholderTextColor="#888"
          value={password2}
          onChangeText={setPassword2}
          secureTextEntry
        />

        <TouchableOpacity style={styles.btnRegistro} onPress={handleRegistro} disabled={cargando}>
          {cargando
            ? <ActivityIndicator color="white" />
            : <Text style={styles.btnRegistroTexto}>Crear cuenta</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.linkLogin}>
          <Text style={styles.textoLink}>¿Ya tienes cuenta? <Text style={styles.textoLinkBold}>Entra aquí</Text></Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function traducirError(code) {
  const errores = {
    'auth/email-already-in-use': 'Ya existe una cuenta con ese email.',
    'auth/invalid-email': 'El email no es válido.',
    'auth/weak-password': 'La contraseña es demasiado débil.',
  };
  return errores[code] || 'Error desconocido. Inténtalo de nuevo.';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f4c2a' },
  inner: { flex: 1, justifyContent: 'center', padding: 30 },
  btnVolver: { position: 'absolute', top: 55, left: 20 },
  textoVolver: { color: 'rgba(255,255,255,0.8)', fontSize: 16 },
  titulo: { fontSize: 32, fontWeight: 'bold', color: 'white', marginBottom: 6 },
  subtitulo: { fontSize: 15, color: 'rgba(255,255,255,0.65)', marginBottom: 30 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14, padding: 16, fontSize: 16,
    color: 'white', marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  btnRegistro: {
    backgroundColor: '#F59E0B', borderRadius: 14, padding: 16,
    alignItems: 'center', marginTop: 8,
  },
  btnRegistroTexto: { color: '#1a1a1a', fontWeight: 'bold', fontSize: 17 },
  linkLogin: { marginTop: 20, alignItems: 'center' },
  textoLink: { color: 'rgba(255,255,255,0.7)', fontSize: 15 },
  textoLinkBold: { color: 'white', fontWeight: 'bold' },
});
