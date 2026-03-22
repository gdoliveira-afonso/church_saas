// error-page.js — Telas de erro de domínio (sem branding de org)
// Usada pelo boot() em app.js quando domainStatus é 'ip-blocked' ou 'domain-unknown'.

const CONFIGS = {
    'ip-blocked': {
        icon: 'shield_lock',
        iconColor: 'text-red-400',
        iconBg: 'bg-red-50',
        title: 'Acesso via IP Bloqueado',
        subtitle: 'Este endereço não está disponível',
        message: 'O acesso direto por endereço IP não é permitido nesta plataforma.',
        hint: 'Utilize o domínio da sua organização para acessar o sistema.',
        hintIcon: 'language',
    },
    'domain-unknown': {
        icon: 'public_off',
        iconColor: 'text-amber-400',
        iconBg: 'bg-amber-50',
        title: 'Domínio Não Registrado',
        subtitle: 'Este endereço não está associado a nenhuma organização',
        message: 'Não encontramos nenhuma organização cadastrada para este domínio.',
        hint: 'Verifique o endereço digitado ou entre em contato com o suporte da sua organização.',
        hintIcon: 'help_outline',
    },
    'inactive': {
        icon: 'block',
        iconColor: 'text-slate-400',
        iconBg: 'bg-slate-100',
        title: 'Organização Suspensa',
        subtitle: 'Os serviços desta organização estão temporariamente indisponíveis',
        message: 'Esta organização está com os serviços suspensos.',
        hint: 'Entre em contato com o administrador para mais informações.',
        hintIcon: 'info',
    },
};

export function errorPageView(type) {
    const c = CONFIGS[type] || CONFIGS['domain-unknown'];

    const app = document.getElementById('app');
    const sb = document.getElementById('sidebar');
    if (sb) sb.classList.add('sidebar-hidden');
    document.documentElement.classList.remove('dark');

    app.innerHTML = `
        <div class="min-h-screen w-full flex items-center justify-center bg-slate-50 px-4">
            <div class="max-w-md w-full text-center">

                <!-- Logo SGI -->
                <div class="flex justify-center mb-8">
                    <div class="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <span class="material-symbols-outlined text-primary text-3xl">church</span>
                    </div>
                </div>

                <!-- Ícone de erro -->
                <div class="flex justify-center mb-6">
                    <div class="w-20 h-20 rounded-full ${c.iconBg} flex items-center justify-center">
                        <span class="material-symbols-outlined ${c.iconColor} text-4xl">${c.icon}</span>
                    </div>
                </div>

                <!-- Título -->
                <h1 class="text-2xl font-bold text-slate-800 mb-2">${c.title}</h1>
                <p class="text-sm font-medium text-slate-500 mb-6">${c.subtitle}</p>

                <!-- Mensagem -->
                <div class="bg-white border border-slate-200 rounded-2xl p-6 mb-6 text-left shadow-sm">
                    <p class="text-sm text-slate-600 mb-4">${c.message}</p>
                    <div class="flex items-start gap-3 bg-slate-50 rounded-xl p-4">
                        <span class="material-symbols-outlined text-slate-400 text-lg mt-0.5 shrink-0">${c.hintIcon}</span>
                        <p class="text-sm text-slate-500">${c.hint}</p>
                    </div>
                </div>

                <!-- Rodapé -->
                <p class="text-xs text-slate-400">SGI — Sistema de Gestão Integrada</p>
            </div>
        </div>
    `;
}
