import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Image,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';
import { authService } from '../services/authService';
import { activityService } from '../services/activityService';

export default function BiometricLock({ onUnlock }) {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const { primaryColor, textColor } = useConfig();

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState(null);
  const [checking, setChecking] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
    ]).start();

    initBiometrics();
  }, []);

  const initBiometrics = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (hasHardware && isEnrolled) {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
      setBiometricType(hasFace ? 'face' : 'fingerprint');
      setBiometricAvailable(true);
      // Auto-prompt after short delay so the screen renders first
      setTimeout(() => authenticate(), 600);
    } else {
      // No biometrics enrolled — unlock directly (device has no lock set up)
      await activityService.updateLastActivity();
      onUnlock();
    }
  };

  const authenticate = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirma tu identidad para entrar',
        fallbackLabel: 'Usar contraseña del dispositivo',
        cancelLabel: 'Cancelar',
        disableDeviceFallback: false,
      });
      if (result.success) {
        await activityService.updateLastActivity();
        onUnlock();
      }
    } catch (e) {
      console.warn('Biometric error:', e);
    } finally {
      setChecking(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Cerrar sesión', '¿Quieres salir de tu cuenta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir', style: 'destructive',
        onPress: async () => {
          await activityService.clearActivity();
          await authService.logout();
          router.replace('/auth/login');
        },
      },
    ]);
  };

  const displayName = userProfile?.username || user?.email?.split('@')[0] || '?';
  const iniciales = (n) => (n || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const biometricEmoji = biometricType === 'face' ? '🔓' : '👆';
  const biometricLabel = biometricType === 'face' ? 'Usar Face ID' : 'Usar huella dactilar';

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.inner}>
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* Avatar */}
          <View style={[styles.avatar, { backgroundColor: primaryColor }]}>
            {userProfile?.photoURL ? (
              <Image source={{ uri: userProfile.photoURL }} style={styles.avatarImg} />
            ) : (
              <Text style={[styles.avatarInitials, { color: textColor }]}>
                {iniciales(displayName)}
              </Text>
            )}
          </View>

          <Text style={styles.greeting}>Hola, {displayName}</Text>
          <Text style={styles.subtitle}>Han pasado varios días. Confirma que eres tú.</Text>

          {/* Biometric button */}
          {biometricAvailable && (
            <TouchableOpacity
              style={[styles.btnBiometric, { backgroundColor: primaryColor }]}
              onPress={authenticate}
              disabled={checking}
              activeOpacity={0.85}
            >
              {checking ? (
                <ActivityIndicator color={textColor} />
              ) : (
                <>
                  <Text style={styles.btnEmoji}>{biometricEmoji}</Text>
                  <Text style={[styles.btnText, { color: textColor }]}>{biometricLabel}</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Sign out */}
          <TouchableOpacity style={styles.btnSalir} onPress={handleSignOut}>
            <Text style={styles.btnSalirText}>Cerrar sesión</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f172a',
    zIndex: 999,
  },
  inner: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center', paddingHorizontal: 40, width: '100%' },

  avatar: {
    width: 100, height: 100, borderRadius: 50,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 20,
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitials: { fontSize: 36, fontWeight: 'bold' },

  greeting: {
    fontSize: 26, fontWeight: 'bold', color: 'white',
    textAlign: 'center', marginBottom: 10,
  },
  subtitle: {
    fontSize: 15, color: 'rgba(255,255,255,0.55)',
    textAlign: 'center', lineHeight: 22, marginBottom: 40,
  },

  btnBiometric: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 16, paddingHorizontal: 36,
    borderRadius: 30, width: '100%', justifyContent: 'center',
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.3,
    shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  btnEmoji: { fontSize: 22 },
  btnText: { fontSize: 17, fontWeight: 'bold' },

  btnSalir: { marginTop: 28, paddingVertical: 10, paddingHorizontal: 24 },
  btnSalirText: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
});
