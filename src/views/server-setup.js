/**
 * Tela de configuração do servidor — exibida no primeiro boot do app nativo
 * quando nenhum servidor está configurado, ou ao trocar de servidor.
 */
import { setServerUrl } from '../native/server-config.js';

export async function serverSetupView({ onSuccess } = {}) {
  const app = document.getElementById('app');
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.add('sidebar-hidden');

  let isConnecting = false;

  const render = (errorMsg = '') => {
    app.innerHTML = `
      <div class="flex-1 flex flex-col items-center justify-center min-h-full bg-slate-50 px-6 py-10">
        <div class="w-full max-w-sm">

          <!-- Logo / Ícone -->
          <div class="flex flex-col items-center mb-10">
            <div class="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg mb-4">
              <span class="material-symbols-outlined text-white text-3xl">church</span>
            </div>
            <h1 class="text-2xl font-bold text-slate-900">SGI v1.0</h1>
            <p class="text-sm text-slate-500 mt-1 text-center">Conecte ao seu servidor</p>
          </div>

          <!-- Formulário -->
          <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1.5">
                URL do servidor
              </label>
              <input
                id="server-url-input"
                type="url"
                inputmode="url"
                placeholder="https://crm.minhaigreja.com"
                value=""
                class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                autocapitalize="none"
                autocorrect="off"
                spellcheck="false"
              />
              ${errorMsg ? `
              <p class="mt-2 text-sm text-red-600 flex items-center gap-1.5">
                <span class="material-symbols-outlined text-base">error</span>
                ${errorMsg}
              </p>` : ''}
            </div>

            <button
              id="connect-btn"
              class="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              ${isConnecting ? 'disabled' : ''}
            >
              ${isConnecting
                ? '<span class="material-symbols-outlined animate-spin text-lg">refresh</span> Conectando...'
                : '<span class="material-symbols-outlined text-lg">login</span> Conectar'
              }
            </button>
          </div>

          <p class="mt-6 text-xs text-slate-400 text-center leading-relaxed">
            Digite o endereço completo do servidor onde o<br>
            SGI está instalado (incluindo https://)
          </p>
        </div>
      </div>
    `;

    const input = document.getElementById('server-url-input');
    const btn = document.getElementById('connect-btn');

    // Foco automático no input
    setTimeout(() => input?.focus(), 100);

    // Enter no teclado dispara conexão
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') btn?.click();
    });

    btn?.addEventListener('click', async () => {
      if (isConnecting) return;

      const rawUrl = input.value.trim();
      if (!rawUrl) {
        render('Por favor, informe a URL do servidor.');
        return;
      }

      // Normaliza URL
      let url = rawUrl;
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }
      url = url.replace(/\/+$/, '');

      isConnecting = true;
      render();

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        // Tenta /api/public/info primeiro; fallback para /api/public/config (servidores antigos)
        let validated = false;
        let fetchError = null;

        for (const endpoint of ['/api/public/info', '/api/public/config']) {
          try {
            const res = await fetch(`${url}${endpoint}`, { signal: controller.signal });
            if (res.ok) {
              validated = true;
              break;
            }
          } catch (e) {
            fetchError = e;
            if (e.name === 'AbortError') break; // timeout — não tenta mais
          }
        }

        clearTimeout(timeoutId);

        if (!validated) {
          isConnecting = false;
          if (fetchError?.name === 'AbortError') {
            render('Tempo esgotado. O servidor não respondeu em 10 segundos.');
          } else {
            render('Servidor não encontrado. Verifique a URL e a conexão com a internet.');
          }
          return;
        }

        // Sucesso — salva URL e continua
        await setServerUrl(url);
        isConnecting = false;

        if (typeof onSuccess === 'function') {
          onSuccess(url);
        } else {
          // Recarrega para reinicializar o app com a nova URL
          window.location.reload();
        }
      } catch (e) {
        isConnecting = false;
        render('Erro inesperado. Tente novamente.');
      }
    });
  };

  render();
}
