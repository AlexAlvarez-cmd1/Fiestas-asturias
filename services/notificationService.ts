import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// Configurar el handler de notificaciones
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const notificationService = {
  /**
   * Solicitar permisos para notificaciones
   */
  async requestPermissions() {
    if (!Device.isDevice) {
      console.warn('Las notificaciones solo funcionan en dispositivos físicos');
      return false;
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  },

  /**
   * Obtener el token de Expo Push Notification
   */
  async getExpoPushToken() {
    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

      if (!projectId) {
        console.warn('No se encontró el projectId de EAS. Para usar notificaciones remotas de Expo, configura EAS.');
        return null;
      }

      const token = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      return token.data;
    } catch (error) {
      console.error('Error obteniendo token de notificación:', error);
      return null;
    }
  },

  /**
   * Enviar notificación local
   */
  async sendLocalNotification(
    title: string,
    body: string,
    data?: Record<string, any>
  ) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: true,
          badge: 1,
          vibrate: [0, 250, 250, 250],
        },
        trigger: null, // Enviar inmediatamente
      });
    } catch (error) {
      console.error('Error enviando notificación:', error);
    }
  },

  /**
   * Programar notificación para una hora específica
   */
  async scheduleNotification(
    title: string,
    body: string,
    date: Date,
    data?: Record<string, any>
  ) {
    try {
      const trigger = new Date(date.getTime() - 24 * 60 * 60 * 1000); // 24 horas antes

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: true,
          badge: 1,
          vibrate: [0, 250, 250, 250],
        },
        trigger: {
          type: 'date',
          date: trigger,
        },
      });
    } catch (error) {
      console.error('Error programando notificación:', error);
    }
  },

  /**
   * Escuchar notificaciones recibidas
   */
  onNotificationReceived(callback: (notification: Notifications.Notification) => void) {
    return Notifications.addNotificationReceivedListener(callback);
  },

  /**
   * Escuchar notificaciones presionadas
   */
  onNotificationPressed(
    callback: (response: Notifications.NotificationResponse) => void
  ) {
    return Notifications.addNotificationResponseReceivedListener(callback);
  },

  /**
   * Limpiar listeners
   */
  removeListeners(subscriptions: Notifications.EventSubscription[]) {
    subscriptions.forEach(sub => sub.remove());
  },

  /**
   * Cancelar todas las notificaciones programadas
   */
  async cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },

  /**
   * Cancelar una notificación específica
   */
  async cancelNotification(notificationId: string) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  },
};
