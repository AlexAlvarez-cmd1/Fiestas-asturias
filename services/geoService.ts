import * as Location from 'expo-location';

export const geoService = {
  /**
   * Solicitar permisos de ubicación
   */
  async requestLocationPermission() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  },

  /**
   * Obtener ubicación actual del usuario
   */
  async getCurrentLocation() {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.error('Error obteniendo ubicación:', error);
      return null;
    }
  },

  /**
   * Calcular distancia entre dos puntos en km
   */
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  /**
   * Verificar si una fiesta está dentro de un radio
   */
  isFiestaWithinRadius(
    fiesta: any,
    userLocation: { latitude: number; longitude: number },
    radiusKm: number
  ): boolean {
    const distance = this.calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      fiesta.ubicacion.latitude,
      fiesta.ubicacion.longitude
    );
    return distance <= radiusKm;
  },

  /**
   * Obtener días restantes hasta una fiesta
   */
  getDaysUntilFiesta(fechaFiesta: string | Date): number {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const fecha = typeof fechaFiesta === 'string' ? new Date(fechaFiesta) : fechaFiesta;
    fecha.setHours(0, 0, 0, 0);

    const diferencia = fecha.getTime() - hoy.getTime();
    const dias = Math.ceil(diferencia / (1000 * 60 * 60 * 24));
    return Math.max(0, dias);
  },

  /**
   * Verificar si una fiesta es próxima (dentro de X días)
   */
  isFiestaProxima(fechaFiesta: string | Date, diasAnticipacion: number = 7): boolean {
    const diasRestantes = this.getDaysUntilFiesta(fechaFiesta);
    return diasRestantes >= 0 && diasRestantes <= diasAnticipacion;
  },

  /**
   * Formatear fecha a español
   */
  formatDate(fecha: string | Date): string {
    const date = typeof fecha === 'string' ? new Date(fecha) : fecha;
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  },
};
