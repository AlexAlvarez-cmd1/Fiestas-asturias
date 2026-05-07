import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { favoritesService } from './favoritesService';
import { geoService } from './geoService';
import { notificationService } from './notificationService';

export interface Fiesta {
  id: string;
  nombre: string;
  fecha: string;
  concejo: string;
  orquesta?: string;
  ubicacion: {
    latitude: number;
    longitude: number;
  };
  [key: string]: any;
}

export const fiestasMonitorService = {
  /**
   * Monitorear fiestas favoritas próximas
   */
  async checkFavoritesNotifications() {
    try {
      console.log('🔔 Verificando fiestas favoritas...');

      // Obtener favoritos y fiestas de Firestore
      let favorites: string[] = [];
      try {
        favorites = await favoritesService.getFavorites();
      } catch (error) {
        console.warn('⚠️ No se pudieron obtener favoritos:', error);
        return; // Si no podemos obtener favoritos, salir silenciosamente
      }

      if (favorites.length === 0) {
        console.log('No hay favoritos guardados');
        return;
      }

      const allFiestas = await this.getAllFiestas();
      const favoritesFiestas = allFiestas.filter(f => favorites.includes(f.id));

      for (const fiesta of favoritesFiestas) {
        try {
          const diasRestantes = geoService.getDaysUntilFiesta(fiesta.fecha);
          let alreadyNotified = false;
          
          try {
            alreadyNotified = await favoritesService.isAlreadyNotifiedFavorite(fiesta.id);
          } catch (error) {
            console.warn(`⚠️ Error verificando notificación previa: ${fiesta.id}`);
          }

          // Notificar 7 días antes
          if (diasRestantes === 7 && !alreadyNotified) {
            await notificationService.sendLocalNotification(
              '⭐ ¡Tu fiesta favorita se acerca!',
              `${fiesta.nombre} es en una semana (${geoService.formatDate(fiesta.fecha)})`,
              { 
                fiestaId: fiesta.id,
                type: 'favorite_7days',
                nombre: fiesta.nombre,
                fecha: fiesta.fecha,
              }
            );
            try {
              await favoritesService.markFavoriteNotified(fiesta.id);
            } catch (error) {
              console.warn(`⚠️ Error marcando como notificada: ${fiesta.id}`);
            }
            console.log(`✅ Notificación enviada: ${fiesta.nombre} (7 días)`);
          }

          // Notificar 3 días antes
          if (diasRestantes === 3 && !alreadyNotified) {
            await notificationService.sendLocalNotification(
              '⭐ ¡Tu favorita es en 3 días!',
              `${fiesta.nombre} - ${geoService.formatDate(fiesta.fecha)}`,
              {
                fiestaId: fiesta.id,
                type: 'favorite_3days',
                nombre: fiesta.nombre,
                fecha: fiesta.fecha,
              }
            );
            try {
              await favoritesService.markFavoriteNotified(fiesta.id);
            } catch (error) {
              console.warn(`⚠️ Error marcando como notificada: ${fiesta.id}`);
            }
            console.log(`✅ Notificación enviada: ${fiesta.nombre} (3 días)`);
          }

          // Notificar 1 día antes
          if (diasRestantes === 1 && !alreadyNotified) {
            await notificationService.sendLocalNotification(
              '⭐ ¡Mañana es tu fiesta favorita!',
              `${fiesta.nombre} - No te la pierdas 🎉`,
              {
                fiestaId: fiesta.id,
                type: 'favorite_tomorrow',
                nombre: fiesta.nombre,
                fecha: fiesta.fecha,
              }
            );
            try {
              await favoritesService.markFavoriteNotified(fiesta.id);
            } catch (error) {
              console.warn(`⚠️ Error marcando como notificada: ${fiesta.id}`);
            }
            console.log(`✅ Notificación enviada: ${fiesta.nombre} (mañana)`);
          }
        } catch (error) {
          console.warn(`⚠️ Error procesando fiesta favorita ${fiesta.id}:`, error);
          // Continuar con la siguiente fiesta
        }
      }
    } catch (error) {
      console.error('Error verificando favoritos:', error);
    }
  },

  /**
   * Monitorear fiestas cercanas
   */
  async checkNearbyFiestasNotifications(radiusKm: number = 20, diasAnticipacion: number = 7) {
    try {
      console.log(`🗺️ Verificando fiestas cercanas (${radiusKm} km)...`);

      // Obtener ubicación del usuario
      const userLocation = await geoService.getCurrentLocation();
      if (!userLocation) {
        console.warn('No se pudo obtener la ubicación del usuario');
        return;
      }

      // Obtener todas las fiestas
      const allFiestas = await this.getAllFiestas();

      // Filtrar fiestas cercanas y próximas
      const nearbyFiestas = allFiestas.filter(fiesta => {
        const isCercana = geoService.isFiestaWithinRadius(fiesta, userLocation, radiusKm);
        const isProxima = geoService.isFiestaProxima(fiesta.fecha, diasAnticipacion);
        return isCercana && isProxima;
      });

      for (const fiesta of nearbyFiestas) {
        try {
          let alreadyNotified = false;
          
          try {
            alreadyNotified = await favoritesService.isAlreadyNotifiedNearby(fiesta.id);
          } catch (error) {
            console.warn(`⚠️ Error verificando notificación previa: ${fiesta.id}`);
          }

          if (!alreadyNotified) {
            const distance = geoService.calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              fiesta.ubicacion.latitude,
              fiesta.ubicacion.longitude
            );

            await notificationService.sendLocalNotification(
              `🎉 ¡Hay una fiesta cerca! (${Math.round(distance)} km)`,
              `${fiesta.nombre} en ${fiesta.concejo} - ${geoService.formatDate(fiesta.fecha)}`,
              {
                fiestaId: fiesta.id,
                type: 'nearby_fiesta',
                nombre: fiesta.nombre,
                fecha: fiesta.fecha,
                distancia: Math.round(distance),
                concejo: fiesta.concejo,
              }
            );
            try {
              await favoritesService.markNearbyNotified(fiesta.id);
            } catch (error) {
              console.warn(`⚠️ Error marcando cercana como notificada: ${fiesta.id}`);
            }
            console.log(`✅ Notificación cercana enviada: ${fiesta.nombre} (${Math.round(distance)} km)`);
          }
        } catch (error) {
          console.warn(`⚠️ Error procesando fiesta cercana ${fiesta.id}:`, error);
          // Continuar con la siguiente fiesta
        }
      }

      if (nearbyFiestas.length === 0) {
        console.log('No hay fiestas cercanas en los próximos días');
      }
    } catch (error) {
      console.error('Error verificando fiestas cercanas:', error);
    }
  },

  /**
   * Obtener todas las fiestas de Firestore
   */
  async getAllFiestas(): Promise<Fiesta[]> {
    try {
      const querySnapshot = await getDocs(collection(db, 'fiestas'));
      const fiestas: Fiesta[] = [];

      querySnapshot.forEach(doc => {
        fiestas.push({
          id: doc.id,
          ...doc.data(),
        } as Fiesta);
      });

      return fiestas;
    } catch (error) {
      console.error('Error obteniendo fiestas:', error);
      return [];
    }
  },

  /**
   * Iniciar monitoreo continuo
   * Se ejecuta al iniciar la app y luego cada X horas
   */
  async startMonitoring(
    favoriteRadiusKm: number = 20,
    favoriteAnticipacionDias: number = 7,
    checkIntervalHours: number = 1
  ) {
    try {
      console.log('🚀 Iniciando monitoreo de notificaciones...');

      // Verificar inmediatamente
      await this.checkFavoritesNotifications();
      await this.checkNearbyFiestasNotifications(favoriteRadiusKm, favoriteAnticipacionDias);

      // Configurar intervalos de verificación
      const checkInterval = setInterval(async () => {
        console.log('⏰ Ejecutando chequeo programado de notificaciones');
        await this.checkFavoritesNotifications();
        await this.checkNearbyFiestasNotifications(favoriteRadiusKm, favoriteAnticipacionDias);
      }, checkIntervalHours * 60 * 60 * 1000);

      return checkInterval;
    } catch (error) {
      console.error('Error iniciando monitoreo:', error);
    }
  },

  /**
   * Detener monitoreo
   */
  stopMonitoring(intervalId: NodeJS.Timeout) {
    if (intervalId) {
      clearInterval(intervalId);
      console.log('⏹️ Monitoreo de notificaciones detenido');
    }
  },
};
