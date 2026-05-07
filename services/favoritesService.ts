import { storageService } from './storageService';

const FAVORITES_KEY = 'fiestas_favoritas';
const NOTIFIED_FAVORITES_KEY = 'fiestas_notificadas_favoritas';
const NOTIFIED_NEARBY_KEY = 'fiestas_notificadas_cercanas';

export const favoritesService = {
  /**
   * Agregar una fiesta a favoritos
   */
  async addFavorite(fiestaId: string) {
    try {
      const favorites = await this.getFavorites();
      if (!favorites.includes(fiestaId)) {
        favorites.push(fiestaId);
        await storageService.setItem(FAVORITES_KEY, JSON.stringify(favorites));
      }
    } catch (error) {
      console.error('Error agregando favorito:', error);
    }
  },

  /**
   * Remover una fiesta de favoritos
   */
  async removeFavorite(fiestaId: string) {
    try {
      const favorites = await this.getFavorites();
      const filtered = favorites.filter(id => id !== fiestaId);
      await storageService.setItem(FAVORITES_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error removiendo favorito:', error);
    }
  },

  /**
   * Obtener lista de favoritos
   */
  async getFavorites(): Promise<string[]> {
    try {
      const favorites = await storageService.getItem(FAVORITES_KEY);
      return favorites ? JSON.parse(favorites) : [];
    } catch (error) {
      console.error('Error obteniendo favoritos:', error);
      return [];
    }
  },

  /**
   * Verificar si una fiesta es favorita
   */
  async isFavorite(fiestaId: string): Promise<boolean> {
    const favorites = await this.getFavorites();
    return favorites.includes(fiestaId);
  },

  /**
   * Guardar que ya notificamos sobre una fiesta favorita
   */
  async markFavoriteNotified(fiestaId: string) {
    try {
      const notified = await storageService.getItem(NOTIFIED_FAVORITES_KEY);
      const notifiedList = notified ? JSON.parse(notified) : [];
      if (!notifiedList.includes(fiestaId)) {
        notifiedList.push(fiestaId);
        await storageService.setItem(NOTIFIED_FAVORITES_KEY, JSON.stringify(notifiedList));
      }
    } catch (error) {
      console.error('Error marcando favorito como notificado:', error);
    }
  },

  /**
   * Obtener fiestas favoritas notificadas
   */
  async getNotifiedFavorites(): Promise<string[]> {
    try {
      const notified = await storageService.getItem(NOTIFIED_FAVORITES_KEY);
      return notified ? JSON.parse(notified) : [];
    } catch (error) {
      console.error('Error obteniendo favoritos notificados:', error);
      return [];
    }
  },

  /**
   * Verificar si ya notificamos sobre una fiesta favorita
   */
  async isAlreadyNotifiedFavorite(fiestaId: string): Promise<boolean> {
    const notified = await this.getNotifiedFavorites();
    return notified.includes(fiestaId);
  },

  /**
   * Guardar que ya notificamos sobre una fiesta cercana
   */
  async markNearbyNotified(fiestaId: string) {
    try {
      const notified = await storageService.getItem(NOTIFIED_NEARBY_KEY);
      const notifiedList = notified ? JSON.parse(notified) : [];
      if (!notifiedList.includes(fiestaId)) {
        notifiedList.push(fiestaId);
        await storageService.setItem(NOTIFIED_NEARBY_KEY, JSON.stringify(notifiedList));
      }
    } catch (error) {
      console.error('Error marcando cercana como notificada:', error);
    }
  },

  /**
   * Obtener fiestas cercanas notificadas
   */
  async getNotifiedNearby(): Promise<string[]> {
    try {
      const notified = await storageService.getItem(NOTIFIED_NEARBY_KEY);
      return notified ? JSON.parse(notified) : [];
    } catch (error) {
      console.error('Error obteniendo cercanas notificadas:', error);
      return [];
    }
  },

  /**
   * Verificar si ya notificamos sobre una fiesta cercana
   */
  async isAlreadyNotifiedNearby(fiestaId: string): Promise<boolean> {
    const notified = await this.getNotifiedNearby();
    return notified.includes(fiestaId);
  },

  /**
   * Limpiar notificaciones antiguas
   */
  async cleanOldNotifications() {
    try {
      // Podríamos agregar lógica para limpiar registros de fiestas pasadas
      // Por ahora solo dejamos que se acumulen
    } catch (error) {
      console.error('Error limpiando notificaciones antiguas:', error);
    }
  },
};
