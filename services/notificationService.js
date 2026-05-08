import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const notificationService = {
  async requestNotificationPermissions() {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      return finalStatus === 'granted';
    } catch (error) {
      console.warn('Error requesting permissions:', error);
      return false;
    }
  },

  async schedulePushNotification(title, body, delaySeconds = 5, data = {}) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data, sound: true, badge: 1 },
        trigger: { type: 'timeInterval', seconds: delaySeconds, repeats: false },
      });
    } catch (error) {
      console.warn('Error scheduling notification:', error);
    }
  },

  async sendLocalNotification(title, body, data = {}) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data, sound: true, badge: 1 },
        trigger: { type: 'timeInterval', seconds: 1, repeats: false },
      });
    } catch (error) {
      console.warn('Error sending local notification:', error);
    }
  },

  async scheduleAllRemindersForFiesta(fiesta) {
    const ids = [];
    const diasAntes = [
      { dias: 7, msg: '¡Quedan 7 días para la fiesta!' },
      { dias: 4, msg: '¡Quedan 4 días para la fiesta!' },
      { dias: 2, msg: '¡Quedan 2 días! Prepárate.' },
      { dias: 1, msg: '¡Mañana es la folixa! No te la pierdas 🎉' },
    ];

    for (const { dias, msg } of diasAntes) {
      try {
        const triggerDate = new Date(fiesta.fecha);
        triggerDate.setHours(10, 0, 0, 0);
        triggerDate.setDate(triggerDate.getDate() - dias);

        const secondsUntil = Math.floor((triggerDate.getTime() - Date.now()) / 1000);
        if (secondsUntil < 60) continue;

        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: `🎪 ${fiesta.nombre}`,
            body: `${msg} ${fiesta.concejo}`,
            data: { fiestaId: fiesta.id, tipo: 'recordatorio' },
            sound: true,
          },
          trigger: { type: 'timeInterval', seconds: secondsUntil, repeats: false },
        });
        ids.push(id);
      } catch (e) {
        console.warn(`Error programando recordatorio -${dias}d:`, e);
      }
    }
    return ids;
  },

  async cancelAllRemindersForFiesta(notificationIds) {
    for (const id of notificationIds) {
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch (e) {
        console.warn('Error cancelando notificación:', e);
      }
    }
  },

  async scheduleReminderForFiesta(fiesta) {
    return this.scheduleAllRemindersForFiesta(fiesta);
  },

  async cancelReminderForFiesta(notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.warn('Error canceling reminder:', error);
    }
  },

  async cancelNotification(notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.warn('Error canceling notification:', error);
    }
  },

  async cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },

  async notifyNewFiestaInZone(fiesta, distance) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🎉 Nueva fiesta cerca',
          body: `${fiesta.nombre} en ${fiesta.concejo} (${distance.toFixed(1)} km)`,
          data: { fiestaId: fiesta.id, tipo: 'nueva', concejo: fiesta.concejo },
          sound: true,
        },
        trigger: { type: 'timeInterval', seconds: 3, repeats: false },
      });
    } catch (error) {
      console.warn('Error notifying new fiesta:', error);
    }
  },

  onNotificationReceived(callback) {
    return Notifications.addNotificationReceivedListener(callback);
  },

  onNotificationPressed(callback) {
    return Notifications.addNotificationResponseReceivedListener(callback);
  },

  removeListeners(subscriptions) {
    subscriptions.forEach(sub => sub.remove());
  },
};
