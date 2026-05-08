import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BiometricLock from '../components/BiometricLock';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ConfigProvider } from '../contexts/ConfigContext';
import { notificationService } from '../services/notificationService';
import { activityService } from '../services/activityService';

function AuthGuard({ children }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [requiresReauth, setRequiresReauth] = useState(null); // null = checking

  // Check if biometric re-auth is needed when user session is restored
  useEffect(() => {
    if (loading) return;
    if (!user) {
      setRequiresReauth(null);
      return;
    }
    activityService.isReauthRequired().then(required => {
      setRequiresReauth(required);
      if (!required) {
        activityService.updateLastActivity();
      }
    });
  }, [user, loading]);

  // Redirect unauthenticated users
  useEffect(() => {
    if (loading) return;
    if (requiresReauth === null && user) return; // Still checking
    const inAuthGroup = segments[0] === 'auth';
    if (!user && !inAuthGroup) {
      router.replace('/auth/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments, requiresReauth]);

  // Show biometric lock as overlay over the navigation
  return (
    <>
      {children}
      {user && requiresReauth && (
        <BiometricLock onUnlock={() => setRequiresReauth(false)} />
      )}
    </>
  );
}

function NotificationSetup() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    let responseSubscription;

    const init = async () => {
      try {
        await notificationService.requestNotificationPermissions();

        responseSubscription = notificationService.onNotificationPressed?.((response) => {
          const data = response.notification.request.content.data;
          if (data.fiestaId) {
            router.push({ pathname: '/detalle', params: { id: data.fiestaId } });
          }
        });
      } catch (e) {
        console.warn('Error inicializando notificaciones:', e);
      }
    };

    init();

    return () => {
      if (responseSubscription) notificationService.removeListeners?.([responseSubscription]);
    };
  }, [user]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ConfigProvider>
          <AuthGuard>
            <NotificationSetup />
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="auth" options={{ headerShown: false }} />
              <Stack.Screen name="detalle" options={{ title: 'Detalles', animation: 'slide_from_right' }} />
              <Stack.Screen name="nueva" options={{ title: 'Añadir Fiesta', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="editar" options={{ title: 'Editar Fiesta', animation: 'slide_from_right' }} />
              <Stack.Screen name="orquestas" options={{ title: 'Orquestas', animation: 'slide_from_right', headerShown: false }} />
            </Stack>
          </AuthGuard>
        </ConfigProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
