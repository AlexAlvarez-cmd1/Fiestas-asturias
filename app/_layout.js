import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ConfigProvider } from '../contexts/ConfigContext';
import { fiestasMonitorService } from '../services/fiestasMonitorService';
import { notificationService } from '../services/notificationService';

export default function RootLayout() {
  const router = useRouter();
  const monitoringIntervalRef = useRef(null);

  useEffect(() => {
    // Declaramos las variables de suscripción fuera de la función asíncrona
    // para que el cleanup (al final) pueda acceder a ellas.
    let notificationReceivedSubscription;
    let notificationResponseSubscription;

    const initializeNotifications = async () => {
      try {
        // 1. Solicitar permisos de notificaciones
        const hasPermission = await notificationService.requestPermissions();
        
        if (hasPermission) {
          console.log('✅ Permisos de notificaciones otorgados');

          // 2. Obtener token de Expo Push
          const token = await notificationService.getExpoPushToken();
          if (token) {
            console.log('📱 Token de notificaciones:', token);
          }

          // 3. Configurar listeners guardándolos en las variables externas
          notificationReceivedSubscription = notificationService.onNotificationReceived((notification) => {
            console.log('📬 Notificación recibida:', notification);
          });

          notificationResponseSubscription = notificationService.onNotificationPressed((response) => {
            console.log('👆 Notificación presionada:', response);
            
            const data = response.notification.request.content.data;
            if (data.fiestaId) {
              router.push({
                pathname: '/detalle',
                params: { id: data.fiestaId },
              });
            }
          });

          // 4. Iniciar monitoreo
          monitoringIntervalRef.current = await fiestasMonitorService.startMonitoring(
            20, // radiusKm
            7,  // diasAnticipacion
            1   // checkIntervalHours
          );

        } else {
          console.warn('⚠️ Permisos de notificaciones denegados');
        }
      } catch (error) {
        console.error('Error inicializando notificaciones:', error);
      }
    };

    initializeNotifications();

    // ÚNICA FUNCION DE CLEANUP (Síncrona y reconocida por React)
    return () => {
      // Limpiamos los listeners de notificaciones si llegaron a crearse
      if (notificationReceivedSubscription && notificationResponseSubscription) {
        notificationService.removeListeners([
          notificationReceivedSubscription,
          notificationResponseSubscription,
        ]);
      }
      
      // Limpiamos el monitoreo de fiestas
      if (monitoringIntervalRef.current) {
        fiestasMonitorService.stopMonitoring(monitoringIntervalRef.current);
      }
    };
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ConfigProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="detalle" options={{ title: 'Detalles' }} />
          <Stack.Screen name="nueva" options={{ title: 'Añadir Fiesta' }} />
          <Stack.Screen name="editar" options={{ title: 'Editar Fiesta' }} />
        </Stack>
      </ConfigProvider>
    </GestureHandlerRootView>
  );
}