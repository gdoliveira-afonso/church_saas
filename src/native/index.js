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

  let overlaysWebView = true; // assume overlay até provar o contrário

  try {
    const { StatusBar } = await import('@capacitor/status-bar');
    await StatusBar.setOverlaysWebView({ overlay: false });
    // Usa cor primária do sistema cacheada; fallback para o dark padrão
    const _ss = (() => { try { return JSON.parse(localStorage.getItem('system-settings') || '{}'); } catch(_) { return {}; } })();
    const _color = _ss.primaryColor || '#0f172a';
    await StatusBar.setBackgroundColor({ color: _color });

    // Verifica se o setOverlaysWebView realmente funcionou
    // Android 15+ pode ignorar a chamada (edge-to-edge forçado pelo SO)
    try {
      const info = await StatusBar.getInfo();
      overlaysWebView = info.overlays === true;
    } catch (_) {
      overlaysWebView = true; // não conseguiu confirmar — assume overlay
    }
  } catch (e) {
    console.warn('[native] StatusBar setup failed:', e);
  }

  // Atualiza cor da StatusBar quando o sistema emitir o evento de settings
  window.addEventListener('system-settings-loaded', async () => {
    try {
      const ss = JSON.parse(localStorage.getItem('system-settings') || '{}');
      if (ss.primaryColor) await StatusBar.setBackgroundColor({ color: ss.primaryColor });
    } catch(_) {}
  }, { once: false });

  // Se o overlay ainda está ativo, aplica compensação via CSS
  if (overlaysWebView) {
    document.documentElement.classList.add('native-overlay');

    // Mede o valor real de env(safe-area-inset-top) via elemento temporário
    // Em alguns WebViews, env() retorna 0 mesmo em overlay mode
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;top:env(safe-area-inset-top,0px);left:0;width:1px;height:1px;pointer-events:none;opacity:0;';
    document.body.appendChild(probe);
    const measured = probe.getBoundingClientRect().top;
    document.body.removeChild(probe);

    // Se env() funcionou, usa; senão, usa 28px (padrão Android mdpi/hdpi)
    const safeTop = measured > 4 ? measured : 28;
    document.documentElement.style.setProperty('--safe-area-top', `${safeTop}px`);
  }
}
