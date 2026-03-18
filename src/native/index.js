/**
 * Detecção de ambiente nativo (Capacitor).
 * Retorna true quando rodando dentro do app Android/iOS.
 * Retorna false no browser normal.
 */
export const isNativeApp = () =>
  typeof window !== 'undefined' &&
  window.Capacitor?.isNativePlatform?.() === true;

/**
 * Configura UI nativa: StatusBar não sobrepõe o conteúdo web (safe area).
 * Deve ser chamado no boot do app quando em modo nativo.
 */
export async function setupNativeUI() {
  if (!isNativeApp()) return;
  try {
    const { StatusBar } = await import('@capacitor/status-bar');
    // Conteúdo web começa ABAIXO da status bar (não por baixo)
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setBackgroundColor({ color: '#135bec' });
  } catch (e) {
    console.warn('[native] StatusBar setup failed:', e);
  }
}
