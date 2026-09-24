/**
 * Safe Storage Wrapper
 * Fornece acesso resiliente ao AsyncStorage com fallback em memória automático
 * caso o módulo nativo não esteja disponível ou em ambientes híbridos/web.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const memoryFallback = new Map<string, string>();

export const safeStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
        const value = await AsyncStorage.getItem(key);
        if (value !== null) return value;
      }
    } catch (error) {
      // Falha silenciosa para fallback em memória
    }
    return memoryFallback.get(key) || null;
  },

  async setItem(key: string, value: string): Promise<void> {
    memoryFallback.set(key, value);
    try {
      if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
        await AsyncStorage.setItem(key, value);
      }
    } catch (error) {
      // Mantém valor em memória
    }
  },

  async removeItem(key: string): Promise<void> {
    memoryFallback.delete(key);
    try {
      if (AsyncStorage && typeof AsyncStorage.removeItem === 'function') {
        await AsyncStorage.removeItem(key);
      }
    } catch (error) {
      // Ignora erro nativo
    }
  },
};

export default safeStorage;
