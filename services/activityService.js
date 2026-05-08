import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'lastActivityAt';
const DAYS_UNTIL_REAUTH = 7;

export const activityService = {
  async updateLastActivity() {
    await AsyncStorage.setItem(KEY, Date.now().toString());
  },

  async isReauthRequired() {
    const stored = await AsyncStorage.getItem(KEY);
    if (!stored) return false;
    const elapsed = Date.now() - parseInt(stored, 10);
    return elapsed > DAYS_UNTIL_REAUTH * 24 * 60 * 60 * 1000;
  },

  async clearActivity() {
    await AsyncStorage.removeItem(KEY);
  },
};
