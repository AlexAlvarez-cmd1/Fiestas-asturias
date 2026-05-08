import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const notificationService = {
  async requestNotificationPermissions() {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.warn('Error requesting permissions:', error);
      return false;
    }
  },

  async schedulePushNotification(title, body, delaySeconds = 5, data = {}) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
          badge: 1,
        },
        trigger: { seconds: delaySeconds },
      });
    } catch (error) {
      console.warn('Error scheduling notification:', error);
    }
  },

  async scheduleReminderForFiesta(fiesta) {
    try {
      const fiestaDate = new Date(fiesta.fecha);
      fiestaDate.setHours(10, 0, 0, 0);

      const now = new Date();
      const delaySeconds = Math.floor((fiestaDate.getTime() - now.getTime()) / 1000);

      if (delaySeconds > 0) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `🎪 Recordatorio: ${fiesta.nombre}`,
            body: `Tu fiesta es mañana en ${fiesta.concejo}`,
            data: { fiestaPorId: fiesta.id, tipo: 'recordatorio' },
            sound: true,
          },
          trigger: { seconds: delaySeconds },
        });
      }
    } catch (error) {
      console.warn('Error scheduling reminder:', error);
    }
  },

  async notifyNewFiestaInZone(fiesta, distance) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🎉 Nueva fiesta cerca`,
          body: `${fiesta.nombre} en ${fiesta.concejo} (${distance.toFixed(1)} km)`,
          data: { fiestaPorId: fiesta.id, tipo: 'nueva', concejo: fiesta.concejo },
          sound: true,
        },
        trigger: { seconds: 3 },
      });
    } catch (error) {
      console.warn('Error notifying new fiesta:', error);
    }
  },

  async clearOldNotifications() {
    // Placeholder for future implementation
  },
};

export { notificationService };
