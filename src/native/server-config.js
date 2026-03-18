/**
 * Gerenciamento da URL do servidor no app nativo.
 *
 * Salva em dois lugares:
 * - localStorage: acesso síncrono no carregamento (bootstrap rápido)
 * - @capacitor/preferences: persistência nativa segura (Keychain/EncryptedSharedPreferences)
 */

const STORAGE_KEY = 'capacitor_server_url';

/**
 * Retorna a URL do servidor salva (sincronamente do localStorage).
 * Use no momento do bootstrap do store.
 */
export function getServerUrlSync() {
  return localStorage.getItem(STORAGE_KEY) || '';
}

/**
 * Retorna a URL do servidor via Capacitor Preferences (async, mais confiável).
 */
export async function getServerUrl() {
  // Em browser normal, usa só localStorage
  if (typeof window === 'undefined' || !window.Capacitor?.isNativePlatform?.()) {
    return localStorage.getItem(STORAGE_KEY) || '';
  }

  try {
    const { Preferences } = await import('@capacitor/preferences');
    const { value } = await Preferences.get({ key: STORAGE_KEY });
    if (value) {
      // Mantém o cache do localStorage sincronizado
      localStorage.setItem(STORAGE_KEY, value);
      return value;
    }
  } catch (e) {
    console.warn('[native] Preferences unavailable, using localStorage:', e);
  }

  return localStorage.getItem(STORAGE_KEY) || '';
}

/**
 * Salva a URL do servidor tanto no localStorage quanto no Capacitor Preferences.
 */
export async function setServerUrl(url) {
  const normalized = url.replace(/\/+$/, ''); // remove trailing slash

  localStorage.setItem(STORAGE_KEY, normalized);

  if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key: STORAGE_KEY, value: normalized });
    } catch (e) {
      console.warn('[native] Could not save to Preferences:', e);
    }
  }
}

/**
 * Remove a URL salva (para "trocar de servidor").
 */
export async function clearServerUrl() {
  localStorage.removeItem(STORAGE_KEY);

  if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.remove({ key: STORAGE_KEY });
    } catch (e) {
      console.warn('[native] Could not clear Preferences:', e);
    }
  }
}
