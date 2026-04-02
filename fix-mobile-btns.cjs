const fs = require('fs');
let html = fs.readFileSync('C:/Users/Gabriel/Documents/Projeto Saas/apresentacao.html', 'utf8');

const mobileBtnCSS = [
  '.mob-nav-btn {',
  '  position: fixed;',
  '  top: 50%;',
  '  transform: translateY(-50%);',
  '  width: 52px; height: 88px;',
  '  background: rgba(255,255,255,0.92);',
  '  border: 1px solid rgba(0,0,0,0.1);',
  '  border-radius: 14px;',
  '  box-shadow: 0 4px 24px rgba(0,0,0,0.22);',
  '  font-size: 28px; font-weight: 300;',
  '  color: #374151;',
  '  cursor: pointer;',
  '  z-index: 9999;',
  '  display: flex; align-items: center; justify-content: center;',
  '  -webkit-tap-highlight-color: transparent;',
  '  transition: background 0.15s, opacity 0.2s;',
  '  touch-action: manipulation;',
  '}',
  '.mob-nav-btn:active { background: rgba(200,16,46,0.13); }',
  '.mob-nav-btn.hidden { opacity: 0; pointer-events: none; }'
].join('\n');

const injection = `
  render();

  /* ── MOBILE NAV BUTTONS ── */
  (function() {
    var style = document.createElement('style');
    style.textContent = ${JSON.stringify(mobileBtnCSS)};
    document.head.appendChild(style);

    var btnP = document.createElement('button');
    btnP.className = 'mob-nav-btn';
    btnP.innerHTML = '&#8249;';
    btnP.setAttribute('aria-label', 'Anterior');
    btnP.style.left = '6px';
    document.body.appendChild(btnP);

    var btnN = document.createElement('button');
    btnN.className = 'mob-nav-btn';
    btnN.innerHTML = '&#8250;';
    btnN.setAttribute('aria-label', 'Proximo');
    btnN.style.right = '6px';
    document.body.appendChild(btnN);

    function updateBtns() {
      btnP.classList.toggle('hidden', cur === 0);
      btnN.classList.toggle('hidden', cur === N - 1);
    }

    btnP.addEventListener('click', function(e) { e.stopPropagation(); go(-1); updateBtns(); });
    btnN.addEventListener('click', function(e) { e.stopPropagation(); go(1); updateBtns(); });

    updateBtns();
  })();
})();`;

// Replace the closing of the IIFE
const original = '  render();\n})();';
if (!html.includes(original)) {
  console.error('ERRO: padrao nao encontrado!');
  process.exit(1);
}

html = html.replace(original, injection);

fs.writeFileSync('C:/Users/Gabriel/Documents/Projeto Saas/apresentacao.html', html, 'utf8');
console.log('OK - botoes mobile injetados');

const check = fs.readFileSync('C:/Users/Gabriel/Documents/Projeto Saas/apresentacao.html', 'utf8');
console.log('mob-nav-btn:', check.includes('mob-nav-btn'));
console.log('btnP click listener:', check.includes("btnP.addEventListener('click'"));
console.log('document.body.appendChild:', check.includes('document.body.appendChild'));
