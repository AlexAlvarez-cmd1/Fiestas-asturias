import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'fiestas_cache';
const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 horas

export const cacheService = {
  async getCachedFiestas() {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const { fiestas, timestamp } = JSON.parse(cached);
      const now = Date.now();

      if (now - timestamp > CACHE_DURATION) {
        await this.invalidateCache();
        return null;
      }

      return fiestas;
    } catch (error) {
      console.warn('Error reading cache:', error);
      return null;
    }
  },

  async setCachedFiestas(fiestas) {
    try {
      const data = {
        fiestas,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Error writing cache:', error);
    }
  },

  async invalidateCache() {
    try {
      await AsyncStorage.removeItem(CACHE_KEY);
    } catch (error) {
      console.warn('Error clearing cache:', error);
    }
  },

  async isCacheValid() {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (!cached) return false;

      const { timestamp } = JSON.parse(cached);
      const now = Date.now();

      return now - timestamp <= CACHE_DURATION;
    } catch (error) {
      console.warn('Error checking cache validity:', error);
      return false;
    }
  },

  async getCacheAge() {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const { timestamp } = JSON.parse(cached);
      const ageMs = Date.now() - timestamp;
      const ageMinutes = Math.floor(ageMs / 60000);

      return ageMinutes;
    } catch (error) {
      console.warn('Error getting cache age:', error);
      return null;
    }
  },
};
