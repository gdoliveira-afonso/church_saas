/**
 * Detecção de ambiente nativo (Capacitor).
 * Retorna true quando rodando dentro do app Android/iOS.
 * Retorna false no browser normal.
 */
export const isNativeApp = () =>
  typeof window !== 'undefined' &&
  window.Capacitor?.isNativePlatform?.() === true;
