import { Platform } from 'react-native';

/**
 * Servicio de almacenamiento universal
 * - En dispositivos físicos/emuladores: usa AsyncStorage
 * - En web: usa memoria (para desarrollo)
 */

// Almacenamiento en memoria (fallback para web)
const memoryStorage: Record<string, string> = {};

export const storageService = {
  /**
   * Guardar valor
   */
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        // En web, usar localStorage si está disponible, sino memoria
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(key, value);
            return;
          }
        } catch (e) {
          console.warn('localStorage no disponible, usando memoria');
        }
        memoryStorage[key] = value;
      } else {
        // En dispositivos reales, usar AsyncStorage
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.setItem(key, value);
      }
    } catch (error) {
      console.error(`Error guardando ${key}:`, error);
      // Fallback a memoria
      memoryStorage[key] = value;
    }
  },

  /**
   * Obtener valor
   */
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        // En web, usar localStorage si está disponible, sino memoria
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage.getItem(key);
          }
        } catch (e) {
          console.warn('localStorage no disponible, usando memoria');
        }
        return memoryStorage[key] || null;
      } else {
        // En dispositivos reales, usar AsyncStorage
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        return await AsyncStorage.getItem(key);
      }
    } catch (error) {
      console.error(`Error obteniendo ${key}:`, error);
      // Fallback a memoria
      return memoryStorage[key] || null;
    }
  },

  /**
   * Remover valor
   */
  async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem(key);
            return;
          }
        } catch (e) {
          console.warn('localStorage no disponible');
        }
        delete memoryStorage[key];
      } else {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.removeItem(key);
      }
    } catch (error) {
      console.error(`Error removiendo ${key}:`, error);
      delete memoryStorage[key];
    }
  },

  /**
   * Limpiar todo
   */
  async clear(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.clear();
            return;
          }
        } catch (e) {
          console.warn('localStorage no disponible');
        }
        Object.keys(memoryStorage).forEach(key => delete memoryStorage[key]);
      } else {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.clear();
      }
    } catch (error) {
      console.error('Error limpiando storage:', error);
      Object.keys(memoryStorage).forEach(key => delete memoryStorage[key]);
    }
  },
};
