import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ConfigProvider } from '../contexts/ConfigContext';
import { fiestasMonitorService } from '../services/fiestasMonitorService';
import { notificationService } from '../services/notificationService';

export default function RootLayout() {
  const router = useRouter();
  const monitoringIntervalRef = useRef(null);

  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        // 1. Solicitar permisos de notificaciones
        const hasPermission = await notificationService.requestPermissions();
        
        if (hasPermission) {
          console.log('✅ Permisos de notificaciones otorgados');

          // 2. Obtener token de Expo Push (para notificaciones remotas en el futuro)
          const token = await notificationService.getExpoPushToken();
          if (token) {
            console.log('📱 Token de notificaciones:', token);
            // Aquí podrías guardar el token en tu servidor/Firestore
          }

          // 3. Configurar listeners para notificaciones
          const notificationReceivedSubscription =
            notificationService.onNotificationReceived((notification) => {
              console.log('📬 Notificación recibida:', notification);
            });

          const notificationResponseSubscription =
            notificationService.onNotificationPressed((response) => {
              console.log('👆 Notificación presionada:', response);
              
              // Navegar según el tipo de notificación
              const data = response.notification.request.content.data;
              if (data.fiestaId) {
                router.push({
                  pathname: '/detalle',
                  params: { id: data.fiestaId },
                });
              }
            });

          // 4. Iniciar monitoreo de fiestas favoritas y cercanas
          // Configuración:
          // - 20 km de radio para fiestas cercanas
          // - 7 días de anticipación
          // - Verificar cada 1 hora
          monitoringIntervalRef.current = await fiestasMonitorService.startMonitoring(
            20, // radiusKm
            7,  // diasAnticipacion
            1   // checkIntervalHours
          );

          // Cleanup function
          return () => {
            notificationService.removeListeners([
              notificationReceivedSubscription,
              notificationResponseSubscription,
            ]);
            if (monitoringIntervalRef.current) {
              fiestasMonitorService.stopMonitoring(monitoringIntervalRef.current);
            }
          };
        } else {
          console.warn('⚠️ Permisos de notificaciones denegados');
        }
      } catch (error) {
        console.error('Error inicializando notificaciones:', error);
      }
    };

    initializeNotifications();

    // Cleanup al desmontar
    return () => {
      if (monitoringIntervalRef.current) {
        fiestasMonitorService.stopMonitoring(monitoringIntervalRef.current);
      }
    };
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ConfigProvider>
        <Stack>
          {/* Carga el grupo de pestañas por defecto */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          
          {/* Pantallas que se abren encima (sin pestañas abajo) */}
          <Stack.Screen name="detalle" options={{ title: 'Detalles' }} />
          <Stack.Screen name="nueva" options={{ title: 'Añadir Fiesta' }} />
          <Stack.Screen name="editar" options={{ title: 'Editar Fiesta' }} />
        </Stack>
      </ConfigProvider>
    </GestureHandlerRootView>
  );
}