import { store } from '../store.js';
import { toast } from '../components/ui.js';

const FIELD_TYPE_MAP = {
  text: (f) => `<input type="text" id="pf-${f.name}" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition" placeholder="${f.placeholder || f.name}" ${f.required ? 'required' : ''}/>`,
  email: (f) => `<input type="email" id="pf-${f.name}" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition" placeholder="${f.placeholder || f.name}" ${f.required ? 'required' : ''}/>`,
  phone: (f) => `<input type="tel" id="pf-${f.name}" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition" placeholder="${f.placeholder || f.name}" ${f.required ? 'required' : ''}/>`,
  number: (f) => `<input type="number" id="pf-${f.name}" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition" placeholder="${f.placeholder || f.name}" ${f.required ? 'required' : ''}/>`,
  date: (f) => `<input type="date" id="pf-${f.name}" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition" ${f.required ? 'required' : ''}/>`,
  textarea: (f) => `<textarea id="pf-${f.name}" rows="3" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition resize-none" placeholder="${f.placeholder || f.name}" ${f.required ? 'required' : ''}></textarea>`,
  select: (f) => `<select id="pf-${f.name}" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition" ${f.required ? 'required' : ''}><option value="">— Selecionar —</option>${(f.options || []).map(o => `<option value="${o}">${o}</option>`).join('')}</select>`,
  checkbox: (f) => { const items = f.checkItems || [f.checkLabel || f.name]; return `<div class="space-y-2">${items.map((ci, i) => `<label class="flex items-center gap-2.5 cursor-pointer"><input type="checkbox" class="pf-chk accent-primary w-4 h-4" data-field="${f.name}" data-idx="${i}" ${f.required && items.length === 1 ? 'required' : ''}/><span class="text-sm text-slate-700">${ci}</span></label>`).join('')}</div>`; },
  link: (f) => `
    <a href="${f.placeholder?.startsWith('http') ? f.placeholder : 'https://' + (f.placeholder || '#')}" target="_blank" class="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all font-bold text-sm shadow-sm group">
      <span>${f.name || 'Acessar Link'}</span>
      <span class="material-symbols-outlined text-base group-hover:translate-x-1 transition-transform">open_in_new</span>
    </a>`,
};

export async function publicFormView(params) {
  const app = document.getElementById('app');
  document.documentElement.classList.remove('dark');

  // Load from Public API
  const formId = params?.id;
  let form = null;

  if (formId) {
    app.innerHTML = '<div class="flex-1"></div>'; // Mantém vazio pois a splash screen cobre
    try {
      const res = await fetch(`/api/public/forms/${formId}`);
      if (res.ok) form = await res.json();
    } catch (e) { console.error('Error fetching form', e); }
  }

  if (!form) {
    app.innerHTML = `<div class="flex-1 flex flex-col items-center justify-center p-8">
      <span class="material-symbols-outlined text-5xl text-slate-200 mb-3">error</span>
      <p class="text-lg font-bold text-slate-600 mb-1">Formulário não encontrado</p>
      <p class="text-sm text-slate-400 mb-6">Este formulário não está ativo ou não existe.</p>
      <a href="#/login" class="text-primary font-semibold text-sm hover:underline">← Voltar ao login</a>
    </div>`;
    return;
  }

  const render = () => {
    const appName = store.systemSettings?.appName || 'Gestão Celular';
    const c = form.color || 'blue';
    const colorMap = { emerald: ['emerald-500', 'emerald-100', 'emerald-600'], purple: ['purple-500', 'purple-100', 'purple-600'], blue: ['primary', 'blue-100', 'primary'], orange: ['orange-500', 'orange-100', 'orange-600'], red: ['red-500', 'red-100', 'red-600'] };
    const cc = colorMap[c] || colorMap.blue;

    app.innerHTML = `
    <div class="h-full w-full overflow-y-auto bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col no-scrollbar">
      <header class="bg-white border-b border-slate-100 px-4 py-3 shrink-0 flex items-center gap-3">
        <a href="#/login" class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 transition"><span class="material-symbols-outlined text-slate-500">arrow_back</span></a>
        <div class="w-8 h-8 rounded-lg bg-${cc[1]} flex items-center justify-center text-${cc[2]}"><span class="material-symbols-outlined text-lg">${form.icon || 'description'}</span></div>
        <h1 class="text-sm font-bold">${form.name}</h1>
      </header>
      <div class="flex-1 flex items-start justify-center p-4 md:p-8 shrink-0 min-h-[500px]">
        <div class="w-full max-w-lg">
          <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div class="bg-gradient-to-r from-${cc[0]}/10 to-${cc[0]}/5 p-6 text-center">
              <div class="w-14 h-14 mx-auto rounded-xl bg-${cc[1]} flex items-center justify-center text-${cc[2]} mb-3"><span class="material-symbols-outlined text-2xl">${form.icon || 'description'}</span></div>
              <h2 class="text-xl font-extrabold text-slate-900">${form.name}</h2>
              ${form.subtitle ? `<p class="text-sm text-slate-500 mt-1">${form.subtitle}</p>` : ''}
            </div>
            <form id="public-form" class="p-6 space-y-4">
              ${form.fields.map(f => {
      const renderer = FIELD_TYPE_MAP[f.type] || FIELD_TYPE_MAP.text;
      return `<div>
                  ${f.type !== 'link' ? `<label class="text-xs font-semibold text-slate-600 mb-1.5 block">${f.name}${f.required ? ' <span class="text-red-400">*</span>' : ''}</label>` : ''}
                  ${renderer(f)}
                </div>`;
    }).join('')}
              <button type="submit" class="w-full bg-${cc[0]} text-white py-3 rounded-lg text-sm font-bold hover:opacity-90 active:scale-[.98] transition-all shadow-sm mt-2">Enviar Formulário</button>
            </form>
          </div>
          <p class="text-center text-[11px] text-slate-400 mt-4">${appName} • SGI v1.1</p>
        </div>
      </div>
    </div>`;

    // Local masks
    document.querySelectorAll('input').forEach(input => {
      const isPhone = input.type === 'tel' ||
        (input.placeholder && (input.placeholder.toLowerCase().includes('tele') ||
          input.placeholder.toLowerCase().includes('whats') ||
          input.placeholder.toLowerCase().includes('celular'))) ||
        (input.id && (input.id.toLowerCase().includes('tele') ||
          input.id.toLowerCase().includes('whats') ||
          input.id.toLowerCase().includes('celular')));

      if (isPhone) {
        // Pre-format current value
        if (input.value) {
          let v = input.value.replace(/\D/g, '');
          if (v.length > 11) v = v.slice(0, 11);
          v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
          v = v.replace(/(\d)(\d{4})$/, '$1-$2');
          input.value = v;
        }

        input.addEventListener('input', (e) => {
          let v = e.target.value.replace(/\D/g, ''); // Remove non-digits
          if (v.length > 11) v = v.slice(0, 11);
          v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
          v = v.replace(/(\d)(\d{4})$/, '$1-$2');
          e.target.value = v;
        });
      }
    });

    document.getElementById('public-form').onsubmit = handleFormSubmit;
  };

  const handleFormSubmit = async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const origText = btn.innerHTML;
    btn.innerHTML = 'Enviando...'; btn.disabled = true;

    // Collect all field values
    const data = {};
    form.fields.forEach(f => {
      if (f.type === 'checkbox') {
        const checks = document.querySelectorAll(`.pf-chk[data-field="${f.name}"]`);
        const items = f.checkItems || [f.checkLabel || f.name];
        const selected = [];
        checks.forEach((cb, i) => { if (cb.checked) selected.push(items[i]); });
        data[f.name] = selected.join(', ');
      } else if (f.type === 'link') {
        // Static field, skip
      } else {
        const el = document.getElementById('pf-' + f.name);
        if (el) data[f.name] = el.value;
      }
    });

    try {
      const res = await fetch('/api/public/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formId: form.id, data })
      });

      if (!res.ok) throw new Error('API Error');

      // Show success
      const formEl = document.getElementById('public-form');
      formEl.innerHTML = `
        <div class="text-center py-8">
          <div class="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-4"><span class="material-symbols-outlined text-emerald-600 text-3xl">check_circle</span></div>
          <h3 class="text-lg font-bold text-slate-900 mb-1">Enviado com sucesso!</h3>
          <p class="text-sm text-slate-500 mb-6">Seu formulário foi recebido. Entraremos em contato em breve.</p>
          <a href="#/login" class="inline-block px-6 py-2.5 bg-slate-100 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-200 transition">← Voltar</a>
        </div>`;
    } catch (err) {
      toast('Erro ao enviar formulário, tente novamente.', 'error');
      btn.innerHTML = origText; btn.disabled = false;
    }
  };

  render();
  window.addEventListener('system-settings-loaded', () => {
    const hash = window.location.hash;
    if (hash.startsWith('#/form/public') || hash.startsWith('#/f')) render();
  }, { once: true });

  if (window.__removeSplashScreen) {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(window.__removeSplashScreen);
    } else {
      window.__removeSplashScreen();
    }
  }
}
