const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const prisma = require('./prisma');

/**
 * Converte a logo para base64 para inclusão no PDF
 */
async function processLogoUrl(url) {
    if (!url) return null;
    try {
        if (url.startsWith('/uploads/')) {
            const filePath = path.join(__dirname, '..', url);
            if (fs.existsSync(filePath)) {
                const ext = path.extname(filePath).toLowerCase();
                const mimeType = ext === '.png' ? 'image/png' : ext === '.svg' ? 'image/svg+xml' : 'image/jpeg';
                const base64 = fs.readFileSync(filePath).toString('base64');
                return `data:${mimeType};base64,${base64}`;
            }
        }
    } catch (e) {
        console.error('Erro ao converter logo para base64', e);
    }
    return url;
}

/**
 * Gera PDF Financeiro nos modos: executivo, analitico, individual
 */
async function generateFinancialReport(mode, data) {
    if (data.logoUrl) {
        data.logoUrl = await processLogoUrl(data.logoUrl);
    }

    const html = buildFinancialHtml(mode, data);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath()
    });

    const page = await browser.newPage();
    
    // Ajusta o viewport para o modo individual (WhatsApp/Mobile) se necessário
    if (mode === 'individual') {
        await page.setViewport({ width: 400, height: 800 });
    }

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfOptions = {
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `
            <div style="width: 100%; text-align: center; font-size: 8px; color: #64748b; font-family: 'Inter', sans-serif; padding: 0 20px;">
                <div style="display: flex; justify-content: space-between; width: 100%;">
                    <span>Relatório Financeiro • Gerado em ${new Date().toLocaleDateString('pt-BR')}</span>
                    <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
                </div>
            </div>
        `,
        margin: { top: '20px', bottom: '40px', left: '20px', right: '20px' }
    };

    if (mode === 'individual') {
        // Modo individual é mais compacto, talvez role sem margens grandes ou formato custom
        pdfOptions.format = 'A5'; // Ou mantem A4 mas layout centralizado
        pdfOptions.margin = { top: '10px', bottom: '10px', left: '10px', right: '10px' };
    }

    const pdfBuffer = await page.pdf(pdfOptions);
    await browser.close();
    return pdfBuffer;
}

function buildFinancialHtml(mode, data) {
    const fmt = (v) => 'R$ ' + (Number(v || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    
    const css = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        body { font-family: 'Inter', sans-serif; color: #1e293b; margin: 0; padding: 20px; background: #fff; line-height: 1.5; font-size: 11px; }
        .timbrado { border: 2px solid #f1f5f9; padding: 30px; border-radius: 4px; min-height: 90vh; position: relative; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
        .logo { width: 50px; height: 50px; object-fit: contain; border-radius: 8px; }
        .church-info h1 { font-size: 16px; margin: 0; color: #0f172a; }
        .church-info p { font-size: 9px; margin: 2px 0; color: #64748b; }
        .report-title { text-align: right; }
        .report-title h2 { font-size: 14px; margin: 0; color: #1d4ed8; text-transform: uppercase; }
        .report-title p { font-size: 10px; margin: 2px 0; color: #64748b; }
        
        .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px; }
        .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 12px; text-align: center; }
        .kpi-label { font-size: 9px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 5px; }
        .kpi-value { font-size: 18px; font-weight: 800; color: #0f172a; }
        .delta { font-size: 10px; font-weight: 700; margin-left: 5px; }
        .delta.up { color: #10b981; }
        .delta.down { color: #ef4444; }

        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #f1f5f9; text-align: left; padding: 10px; font-size: 9px; text-transform: uppercase; color: #475569; border-bottom: 2px solid #e2e8f0; }
        td { padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 10px; }
        .text-right { text-align: right; }
        .font-bold { font-weight: 700; }
        
        .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; }

        .section-title { font-size: 13px; font-weight: 700; color: #1e293b; margin-top: 30px; margin-bottom: 15px; border-left: 4px solid #3b82f6; padding-left: 10px; }
        
        .insights-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; }
        .insight-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; }
        .insight-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
        .insight-icon { width: 4px; height: 12px; border-radius: 2px; }
        .insight-title { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; }
        .insight-body { font-size: 11px; color: #334155; font-weight: 500; }

        .chart-container { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 30px; }
        .chart-bars { display: flex; align-items: flex-end; justify-content: space-between; height: 100px; gap: 10px; padding-top: 20px; }
        .bar-group { display: flex; flex-direction: column; align-items: center; flex: 1; }
        .bar-wrapper { display: flex; align-items: flex-end; gap: 2px; height: 80px; width: 100%; border-bottom: 1px solid #e2e8f0; }
        .bar { width: 100%; border-radius: 2px 2px 0 0; position: relative; }
        .bar.income { background: #10b981; }
        .bar.expense { background: #f87171; }
        .bar-label { font-size: 8px; color: #94a3b8; margin-top: 8px; font-weight: 600; text-transform: uppercase; }

        .composition-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    `;

    const header = `
        <div class="header">
            <div class="church-info">
                <div style="display:flex; align-items:center; gap:12px;">
                    ${data.logoUrl ? `<img src="${data.logoUrl}" class="logo" />` : ''}
                    <div>
                        <h1>${data.organizationName}</h1>
                        <p>${data.pastor || ''}</p>
                        <p>${data.address || ''}</p>
                    </div>
                </div>
            </div>
            <div class="report-title">
                <h2>${mode === 'executive' ? 'Relatório Executivo' : mode === 'analitico' ? 'Relatório Analítico' : 'Extrato de Contribuições'}</h2>
                <p>${data.period || ''}</p>
            </div>
        </div>
    `;

    let content = '';

    if (mode === 'executive') {
        const monthsPt = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const formatMonth = (m) => {
            const [y, mm] = m.split('-');
            return monthsPt[parseInt(mm) - 1];
        };

        const maxVal = Math.max(...(data.history || []).map(h => Math.max(h.income, h.expense)), 1);

        const topIncome = data.incomeCategories?.[0]?.name || 'N/A';
        const topExpense = data.expenseCategories?.[0]?.name || 'N/A';
        const resultLabel = data.netBalance >= 0 ? 'Superávit' : 'Déficit';

        content = `
            <div class="kpi-grid">
                <div class="kpi-card">
                    <div class="kpi-label">Receita Total</div>
                    <div class="kpi-value">${fmt(data.totalIncome)}</div>
                    <div class="delta ${data.incomeDelta >= 0 ? 'up' : 'down'}">${data.incomeDelta >= 0 ? '↑' : '↓'} ${Math.abs(data.incomeDelta)}%</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">Despesa Total</div>
                    <div class="kpi-value" style="color:#ef4444">${fmt(data.totalExpense)}</div>
                    <div class="delta ${data.expenseDelta >= 0 ? 'down' : 'up'}">${data.expenseDelta >= 0 ? '↑' : '↓'} ${Math.abs(data.expenseDelta)}%</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">Saldo Líquido</div>
                    <div class="kpi-value" style="color:${data.netBalance >= 0 ? '#10b981' : '#ef4444'}">${fmt(data.netBalance)}</div>
                    <div class="text-[9px] font-bold uppercase mt-1" style="color:#64748b">${resultLabel}</div>
                </div>
            </div>

            <h3 class="section-title">Tendência de Receitas vs Despesas</h3>
            <div class="chart-container">
                <div class="chart-bars">
                    ${(data.history || []).map(h => `
                        <div class="bar-group">
                            <div class="bar-wrapper">
                                <div class="bar income" style="height: ${(h.income / maxVal) * 100}%" title="${fmt(h.income)}"></div>
                                <div class="bar expense" style="height: ${(h.expense / maxVal) * 100}%" title="${fmt(h.expense)}"></div>
                            </div>
                            <span class="bar-label">${formatMonth(h.month)}</span>
                        </div>
                    `).join('')}
                </div>
                <div style="display: flex; gap: 15px; justify-content: center; margin-top: 20px;">
                    <div style="display: flex; align-items: center; gap: 5px;"><div style="width: 8px; height: 8px; background: #10b981; border-radius: 2px;"></div><span style="font-size: 8px; color: #64748b; font-weight: 600;">RECEITAS</span></div>
                    <div style="display: flex; align-items: center; gap: 5px;"><div style="width: 8px; height: 8px; background: #f87171; border-radius: 2px;"></div><span style="font-size: 8px; color: #64748b; font-weight: 600;">DESPESAS</span></div>
                </div>
            </div>

            <div class="insights-grid">
                <div class="insight-card">
                    <div class="insight-header"><div class="insight-icon" style="background: #10b981;"></div><span class="insight-title">Principal Receita</span></div>
                    <div class="insight-body">A maior fonte de recursos no período foi <span class="font-bold">${topIncome}</span>.</div>
                </div>
                <div class="insight-card">
                    <div class="insight-header"><div class="insight-icon" style="background: #f87171;"></div><span class="insight-title">Principal Despesa</span></div>
                    <div class="insight-body">O impacto financeiro mais relevante foi com <span class="font-bold">${topExpense}</span>.</div>
                </div>
            </div>

            <div class="composition-grid">
                <div>
                    <h3 class="section-title">Composição de Receitas</h3>
                    <table>
                        <thead><tr><th>Categoria</th><th class="text-right">Valor</th><th>%</th></tr></thead>
                        <tbody>
                            ${data.incomeCategories.map(c => `
                                <tr>
                                    <td>${c.name}</td>
                                    <td class="text-right font-bold">${fmt(c.amount)}</td>
                                    <td class="text-right">${Math.round((c.amount / (data.totalIncome || 1)) * 100)}%</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div>
                    <h3 class="section-title">Composição de Despesas</h3>
                    <table>
                        <thead><tr><th>Categoria</th><th class="text-right">Valor</th><th>%</th></tr></thead>
                        <tbody>
                            ${data.expenseCategories.map(c => `
                                <tr>
                                    <td>${c.name}</td>
                                    <td class="text-right font-bold">${fmt(c.amount)}</td>
                                    <td class="text-right">${Math.round((c.amount / (data.totalExpense || 1)) * 100)}%</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } else if (mode === 'analitico') {
        content = `
            <div class="kpi-grid">
                <div class="kpi-card">
                    <div class="kpi-label">Entrada Analítica</div>
                    <div class="kpi-value">${fmt(data.totalIncome)}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">Saída Analítica</div>
                    <div class="kpi-value" style="color:#ef4444">${fmt(data.totalExpense)}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">Diferencial</div>
                    <div class="kpi-value" style="color:${data.netBalance >= 0 ? '#10b981' : '#ef4444'}">${fmt(data.netBalance)}</div>
                </div>
            </div>
            <h3 class="section-title">Lançamentos Detalhados</h3>
            <table>
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Descrição</th>
                        <th>Categoria</th>
                        <th class="text-right">Entrada</th>
                        <th class="text-right">Saída</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.transactions.map(t => `
                        <tr>
                            <td>${t.date ? new Date(t.date).toLocaleDateString('pt-BR') : '—'}</td>
                            <td>${t.description}</td>
                            <td>${t.category}</td>
                            <td class="text-right" style="color:#10b981">${t.type === 'RECEITA' ? fmt(t.amount) : '-'}</td>
                            <td class="text-right" style="color:#ef4444">${t.type === 'DESPESA' ? fmt(t.amount) : '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="background:#f8fafc">
                        <td colspan="3" class="font-bold">TOTAL DO PERÍODO</td>
                        <td class="text-right font-bold" style="color:#10b981">${fmt(data.totalIncome)}</td>
                        <td class="text-right font-bold" style="color:#ef4444">${fmt(data.totalExpense)}</td>
                    </tr>
                </tfoot>
            </table>
        `;
    } else if (mode === 'individual') {
        const monthsPt = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const formatMonth = (m) => {
            const [y, mm] = m.split('-');
            return monthsPt[parseInt(mm) - 1];
        };

        const hasTimeline = data.labels && data.data;
        const maxVal = hasTimeline ? Math.max(...data.data, 1) : 1;

        return `
            <!DOCTYPE html><html><head><meta charset="UTF-8"><style>${css}</style></head>
            <body style="background:#f1f5f9; padding:20px;">
                <div class="individual-container" style="background:white; padding:30px; border-radius:8px; border:1px solid #e2e8f0;">
                    <div style="text-align:center; margin-bottom:20px;">
                        ${data.logoUrl ? `<img src="${data.logoUrl}" class="logo" />` : ''}
                        <h2 style="font-size:14px; margin:10px 0 0 0;">${data.organizationName}</h2>
                        <p style="font-size:9px; color:#64748b;">Histórico de Contribuições Individual</p>
                    </div>
                    <div style="border-top:1px dashed #e2e8f0; border-bottom:1px dashed #e2e8f0; padding:15px 0; margin-bottom:15px;">
                        <p style="margin:0; font-size:10px; color:#64748b;">Membro:</p>
                        <h3 style="margin:0; font-size:13px; color:#0f172a;">${data.memberName}</h3>
                        <p style="margin:5px 0 0 0; font-size:9px; color:#1d4ed8; font-weight:600;">Período: ${data.period || 'Geral'}</p>
                    </div>

                    ${hasTimeline ? `
                    <h4 style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom:10px;">Linha do Tempo</h4>
                    <div class="chart-container" style="padding:15px; background: #f8fafc; border-radius:12px;">
                        <div class="chart-bars" style="height: 120px;">
                            ${data.labels.map((l, i) => `
                                <div class="bar-group">
                                    <div class="bar-wrapper" style="height: 90px;">
                                        <div class="bar income" style="height: ${(data.data[i] / maxVal) * 100}%; background:#3b82f6;"></div>
                                    </div>
                                    <span class="bar-label">${formatMonth(l)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}

                    <table style="font-size:9px; margin-top:20px;">
                        <thead><tr><th>Data</th><th>Tipo</th><th class="text-right">Valor</th></tr></thead>
                        <tbody>
                            ${data.donations.map(d => `
                                <tr>
                                    <td>${d.date ? new Date(d.date).toLocaleDateString('pt-BR') : '—'}</td>
                                    <td>${d.type}</td>
                                    <td class="text-right font-bold">${fmt(d.amount)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div style="background:#f8fafc; padding:15px; border-radius:12px; text-align:right; margin-top:20px;">
                        <span style="font-size:10px; color:#64748b; font-weight:600;">TOTAL NO PERÍODO:</span>
                        <div style="font-size:18px; font-weight:800; color:#1d4ed8;">${fmt(data.totalAmount)}</div>
                    </div>

                    <div style="margin-top:30px; border-top:1px solid #e2e8f0; padding-top:10px; text-align:center; font-size:8px; color:#94a3b8;">
                        Relatório gerado em ${new Date().toLocaleDateString('pt-BR')} via SaaS Church
                    </div>
                </div>
            </body></html>
        `;
    }

    return `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><style>${css}</style></head>
        <body>
            <div class="timbrado">
                ${header}
                ${content}
                <div class="footer">
                    <span>Documento Oficial • ${data.organizationName}</span>
                    <span>SaaS Church • Gestão Inteligente</span>
                </div>
            </div>
        </body>
        </html>
    `;
}

module.exports = {
    generateFinancialReport
};
