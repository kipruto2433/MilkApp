import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@milkapp_token';
const USER_KEY = '@milkapp_user';

export async function saveAuth(token, user) {
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.warn('Failed to save auth', e);
  }
}

export async function loadAuth() {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    const userJson = await AsyncStorage.getItem(USER_KEY);
    const user = userJson ? JSON.parse(userJson) : null;
    return { token, user };
  } catch (e) {
    console.warn('Failed to load auth', e);
    return { token: null, user: null };
  }
}

export async function clearAuth() {
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
  } catch (e) {
    console.warn('Failed to clear auth', e);
  }
}

const FARMERS_CACHE_KEY = '@milkapp_farmers_cache';
const PENDING_COLLECTIONS_KEY = '@milkapp_pending_collections';

export async function saveCachedFarmers(farmers) {
  try {
    await AsyncStorage.setItem(FARMERS_CACHE_KEY, JSON.stringify(farmers));
  } catch (e) {
    console.warn('Failed to cache farmers', e);
  }
}

export async function getCachedFarmers() {
  try {
    const data = await AsyncStorage.getItem(FARMERS_CACHE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.warn('Failed to load cached farmers', e);
    return [];
  }
}

export async function savePendingCollection(collection) {
  try {
    const pending = await getPendingCollections();
    pending.push({
      ...collection,
      local_id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
    });
    await AsyncStorage.setItem(PENDING_COLLECTIONS_KEY, JSON.stringify(pending));
  } catch (e) {
    console.warn('Failed to save pending collection', e);
  }
}

export async function getPendingCollections() {
  try {
    const data = await AsyncStorage.getItem(PENDING_COLLECTIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.warn('Failed to load pending collections', e);
    return [];
  }
}

export async function clearPendingCollections() {
  try {
    await AsyncStorage.removeItem(PENDING_COLLECTIONS_KEY);
  } catch (e) {
    console.warn('Failed to clear pending collections', e);
  }
}

const COLLECTOR_PRICE_KEY = '@milkapp_collector_price';

export async function saveCollectorPrice(price) {
  try {
    await AsyncStorage.setItem(COLLECTOR_PRICE_KEY, String(price));
  } catch (e) {
    console.warn('Failed to save collector price', e);
  }
}

export async function getCollectorPrice() {
  try {
    const price = await AsyncStorage.getItem(COLLECTOR_PRICE_KEY);
    return price ? parseFloat(price) : 50; // default to 50
  } catch (e) {
    console.warn('Failed to load collector price', e);
    return 50;
  }
}

const COLLECTOR_PAYMENT_SCHEDULE_KEY = '@milkapp_collector_payment_schedule';

export async function saveCollectorPaymentSchedule(days) {
  try {
    await AsyncStorage.setItem(COLLECTOR_PAYMENT_SCHEDULE_KEY, String(days));
  } catch (e) {
    console.warn('Failed to save collector payment schedule', e);
  }
}

export async function getCollectorPaymentSchedule() {
  try {
    const days = await AsyncStorage.getItem(COLLECTOR_PAYMENT_SCHEDULE_KEY);
    return days ? parseInt(days, 10) : 30; // default to 30 days
  } catch (e) {
    console.warn('Failed to load collector payment schedule', e);
    return 30;
  }
}
