import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Servicio de almacenamiento universal
 * - En dispositivos físicos/emuladores: usa AsyncStorage
 * - En web: usa localStorage (navegador) o memoria (fallback)
 */

// Almacenamiento en memoria (fallback universal)
const memoryStorage: Record<string, string> = {};

export const storageService = {
  /**
   * Guardar valor
   */
  async setItem(key: string, value: string): Promise<void> {
    try {
      // Primero guardar en memoria siempre (como backup)
      memoryStorage[key] = value;

      if (Platform.OS === 'web') {
        // En web, intentar localStorage
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(key, value);
          }
        } catch (e) {
          console.warn(`⚠️ localStorage no disponible para ${key}`);
        }
      } else {
        // En dispositivos reales con AsyncStorage disponible
        try {
          await AsyncStorage.setItem(key, value);
        } catch (error) {
          console.warn(`⚠️ AsyncStorage fallo para ${key}, usando memoria:`, error);
        }
      }
    } catch (error) {
      console.error(`❌ Error guardando ${key}:`, error);
      // Ya está en memoryStorage, es nuestro fallback
    }
  },

  /**
   * Obtener valor
   */
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        // En web, intentar localStorage primero
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            const value = window.localStorage.getItem(key);
            if (value !== null) return value;
          }
        } catch (e) {
          console.warn(`⚠️ localStorage no disponible para ${key}`);
        }
      } else {
        // En dispositivos reales con AsyncStorage disponible
        try {
          const value = await AsyncStorage.getItem(key);
          if (value !== null) {
            // Sincronizar con memoria
            memoryStorage[key] = value;
            return value;
          }
        } catch (error) {
          console.warn(`⚠️ AsyncStorage fallo para ${key}, usando memoria:`, error);
        }
      }

      // Fallback: usar memoria
      return memoryStorage[key] || null;
    } catch (error) {
      console.error(`❌ Error obteniendo ${key}:`, error);
      return memoryStorage[key] || null;
    }
  },

  /**
   * Remover valor
   */
  async removeItem(key: string): Promise<void> {
    try {
      // Remover de memoria
      delete memoryStorage[key];

      if (Platform.OS === 'web') {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem(key);
          }
        } catch (e) {
          console.warn(`⚠️ localStorage no disponible`);
        }
      } else {
        try {
          await AsyncStorage.removeItem(key);
        } catch (error) {
          console.warn(`⚠️ AsyncStorage fallo al remover:`, error);
        }
      }
    } catch (error) {
      console.error(`❌ Error removiendo ${key}:`, error);
    }
  },

  /**
   * Limpiar todo
   */
  async clear(): Promise<void> {
    try {
      // Limpiar memoria
      Object.keys(memoryStorage).forEach(key => delete memoryStorage[key]);

      if (Platform.OS === 'web') {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.clear();
          }
        } catch (e) {
          console.warn(`⚠️ localStorage no disponible`);
        }
      } else {
        try {
          await AsyncStorage.clear();
        } catch (error) {
          console.warn(`⚠️ AsyncStorage fallo al limpiar:`, error);
        }
      }
    } catch (error) {
      console.error(`❌ Error limpiando storage:`, error);
    }
  },
};
