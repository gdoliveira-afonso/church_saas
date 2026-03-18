const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

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
 * Função principal para gerar o PDF a partir dos dados do frontend
 * @param {string} type Tipo do relatório ('executive', 'analytical', 'members', 'cells', 'visits')
 * @param {object} data Dados processados no frontend
 */
async function generatePDF(type, data) {
    if (data.logoUrl) {
        data.logoUrl = await processLogoUrl(data.logoUrl);
    }
    const html = buildHtml(type, data);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath()
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>', // Cabeçalho customizado vai no corpo HTML
        footerTemplate: `
            <div style="width: 100%; text-align: center; font-size: 9px; color: #64748b; font-family: 'Inter', sans-serif; padding: 0 20px;">
                <div style="display: flex; justify-content: space-between; width: 100%;">
                    <span>SGI v1.0 • Gerado em ${new Date().toLocaleDateString('pt-BR')}</span>
                    <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
                </div>
            </div>
        `,
        margin: { top: '20px', bottom: '50px', left: '20px', right: '20px' }
    });

    await browser.close();
    return pdfBuffer;
}

function buildHtml(type, data) {
    const css = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; color: #334155; margin: 0; padding: 0; background: #fff; line-height: 1.4; font-size: 11px; }
        
        .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 15px; page-break-inside: avoid; }
        .church-info { display: flex; align-items: center; gap: 12px; }
        .logo { width: 42px; height: 42px; border-radius: 10px; object-fit: contain; }
        .church-details { display: flex; flex-direction: column; gap: 1px; }
        .church-name { font-size: 13px; font-weight: 800; color: #0f172a; margin: 0; line-height: 1.2; }
        .church-sub { font-size: 8px; color: #64748b; margin: 0; font-weight: 500; text-transform: uppercase; letter-spacing: 0.3px; }
        .church-meta { font-size: 8px; color: #94a3b8; margin: 0; font-weight: 400; }
        
        .report-meta { text-align: right; display: flex; flex-direction: column; justify-content: flex-end; }
        .report-title { font-size: 14px; font-weight: 800; color: #135bec; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.2; }
        .meta-text { font-size: 8px; color: #64748b; margin: 1px 0 0 0; font-weight: 500; }

        .section-header { display: flex; align-items: center; gap: 8px; margin: 20px 0 10px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; page-break-inside: avoid; }
        .section-title { font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin: 0; }
        
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; page-break-inside: avoid; }
        .kpi-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .kpi-val { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 1px; }
        .kpi-label { font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; }
        
        .bars-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; page-break-inside: avoid; }
        .bar-container { background: #fff; padding: 10px; border-radius: 10px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
        .bar-header { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 9px; font-weight: 700; color: #475569; }
        .bar-bg { height: 6px; background: #f1f5f9; border-radius: 10px; overflow: hidden; }
        .bar-fill { height: 100%; border-radius: 10px; }
        
        .insights-grid { display: grid; grid-template-columns: 1fr; gap: 12px; margin-bottom: 15px; }
        .insight-box { border-radius: 12px; padding: 12px 15px; page-break-inside: avoid; border: 1px solid transparent; }
        .insight-box.blue { background: #eff6ff; border-color: #dbeafe; }
        .insight-box.amber { background: #fffbeb; border-color: #fef3c7; }
        .insight-box.red { background: #fef2f2; border-color: #fee2e2; }
        .insight-box .title { font-size: 10px; font-weight: 800; margin-bottom: 6px; text-transform: uppercase; display: flex; align-items: center; gap: 5px; }
        .insight-box ul { margin: 0; padding-left: 15px; }
        .insight-box li { margin-bottom: 4px; font-weight: 500; font-size: 9px; list-style-type: disc; }

        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 9px; page-break-inside: auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
        tr { page-break-inside: avoid; }
        thead th { background: #f8fafc; color: #475569; font-weight: 800; text-transform: uppercase; padding: 8px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 8px; letter-spacing: 0.3px; }
        tbody td { padding: 8px; border-bottom: 1px solid #f1f5f9; color: #475569; vertical-align: middle; }
        tbody tr:last-child td { border-bottom: none; }
        .text-center { text-align: center; }
        .font-bold { font-weight: 700; color: #0f172a; }
        
        .badge { display: inline-block; padding: 2px 6px; border-radius: 6px; font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.2px; }
        .badge-gray { background: #f1f5f9; color: #475569; }
        .badge-green { background: #dcfce7; color: #15803d; }
        .badge-blue { background: #dbeafe; color: #1d4ed8; }
        .badge-purple { background: #f3e8ff; color: #7e22ce; }
        .badge-red { background: #fee2e2; color: #b91c1c; }
        .badge-amber { background: #fef3c7; color: #b45309; }
        .badge-orange { background: #ffedd5; color: #c2410c; }

        .mini-table { font-size: 8px; width: 100%; border: none; margin: 5px 0 0 0; }
        .mini-table th { background: none; border-bottom: 1px solid rgba(0,0,0,0.05); padding: 2px 4px; color: inherit; font-weight: 800; }
        .mini-table td { border-bottom: 1px solid rgba(0,0,0,0.03); padding: 2px 4px; color: inherit; }
    `;

    const commonHeader = `
        <div class="header">
            <div class="church-info">
                ${data.logoUrl ? `<img src="${data.logoUrl}" class="logo" />` : ''}
                <div class="church-details">
                    <h1 class="church-name">${data.congregationName || data.appName || 'SGI v1.0'}</h1>
                    ${data.nucleus ? `<p class="church-sub">Núcleo/Região: ${data.nucleus}</p>` : `<p class="church-sub">Relatório Gerencial Oficial</p>`}
                    ${data.pastorName ? `<p class="church-meta">Responsável: ${data.pastorName}</p>` : ''}
                    ${data.congregationAddress ? `<p class="church-meta">${data.congregationAddress}</p>` : ''}
                </div>
            </div>
            <div class="report-meta">
                <h2 class="report-title">${getReportTitle(type)}</h2>
                <p class="meta-text">Período: ${data.periodLabel}</p>
                <p class="meta-text">${data.total} membros ativos registrados</p>
            </div>
        </div>
    `;

    // EBD reports use a custom header (no "total members" line)
    const ebdHeader = `
        <div class="header">
            <div class="church-info">
                ${data.logoUrl ? `<img src="${data.logoUrl}" class="logo" />` : ''}
                <div class="church-details">
                    <h1 class="church-name">${data.congregationName || data.appName || 'SGI v1.0'}</h1>
                    <p class="church-sub">Escola Bíblica Dominical</p>
                    ${data.pastorName ? `<p class="church-meta">Responsável: ${data.pastorName}</p>` : ''}
                    ${data.congregationAddress ? `<p class="church-meta">${data.congregationAddress}</p>` : ''}
                </div>
            </div>
            <div class="report-meta">
                <h2 class="report-title">${getReportTitle(type)}</h2>
                <p class="meta-text">Período: ${data.periodLabel}</p>
                ${data.className ? `<p class="meta-text">Classe: ${data.className}</p>` : `<p class="meta-text">${data.totalClasses || 0} classe(s) • ${data.totalAlunos || 0} alunos</p>`}
            </div>
        </div>
    `;

    let bodyHtml = '';

    if (type === 'ebd') {
        return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${css}</style></head><body>${ebdHeader}${renderEbdReport(data)}</body></html>`;
    }

    if (type === 'finance') {
        return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${css}</style></head><body>${commonHeader}${renderFinanceReport(data)}</body></html>`;
    }

    if (type === 'ebd_class') {
        return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${css}</style></head><body>${ebdHeader}${renderEbdClassReport(data)}</body></html>`;
    }

    if (type === 'ebd_people') {
        return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${css}</style></head><body>${ebdHeader}${renderEbdPeopleReport(data)}</body></html>`;
    }

    if (type === 'executive' || type === 'analytical') {
        bodyHtml += renderExecutiveSummary(data);
    }

    if (type === 'members' || type === 'analytical') {
        bodyHtml += `<div class="section-header"><div class="section-title">Lista de Membros</div></div>`;
        bodyHtml += renderMembersTable(data);
    }

    if ((type === 'cells' || type === 'analytical') && data.activeCells > 1) {
        bodyHtml += `<div class="section-header"><div class="section-title">Desempenho das Células</div></div>`;
        bodyHtml += renderCellsTable(data);
    }

    if (type === 'visits' || type === 'analytical') {
        bodyHtml += `<div class="section-header"><div class="section-title">Histórico de Visitas</div></div>`;
        bodyHtml += renderVisitsTable(data);
    }

    if (type === 'metrics' || type === 'analytical') {
        bodyHtml += `<div class="section-header"><div class="section-title">Visão Geral de Métricas</div></div>`;
        bodyHtml += renderMetricsReport(data);
    }

    if (type === 'inativos' || type === 'analytical') {
        bodyHtml += `<div class="section-header"><div class="section-title">Inativos / Afastados / Mudou-se</div></div>`;
        bodyHtml += renderInactiveMembersTable(data);
    }

    return `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><style>${css}</style></head>
        <body>
            ${commonHeader}
            ${bodyHtml}
        </body>
        </html>
    `;
}

function getReportTitle(type) {
    const titles = {
        'executive': 'Relatório Executivo',
        'analytical': 'Relatório Analítico Completo',
        'members': 'Relatório de Membros',
        'cells': 'Relatório de Células',
        'visits': 'Relatório de Visitas',
        'metrics': 'Relatório de Métricas Customizadas',
        'inativos': 'Relatório de Inativos / Saída',
        'ebd': 'Relatório EBD',
        'ebd_class': 'Frequência EBD — Classe',
        'ebd_people': 'Lista EBD — Alunos & Professores',
        'finance': 'Relatório Econômico-Financeiro'
    };
    return titles[type] || 'Relatório';
}

function renderExecutiveSummary(d) {
    const kpiGrid1 = `
        <div class="kpi-grid">
            <div class="kpi-card"><div class="kpi-val">${d.novosConvertidos}</div><div class="kpi-label">Novos Convertidos</div></div>
            <div class="kpi-card"><div class="kpi-val">${d.reconciliacoes}</div><div class="kpi-label">Reconciliações</div></div>
            <div class="kpi-card"><div class="kpi-val">${d.visitantes}</div><div class="kpi-label">Visitantes</div></div>
            <div class="kpi-card"><div class="kpi-val">${d.visitsInPeriod.length}</div><div class="kpi-label">Visitas Realizadas</div></div>
        </div>
    `;

    const kpiGrid2 = `
        <div class="kpi-grid" style="${d.activeCells <= 1 ? 'grid-template-columns: repeat(3, 1fr);' : ''}">
            <div class="kpi-card"><div class="kpi-val">${d.freqPct}%</div><div class="kpi-label">Média Frequência</div></div>
            ${d.activeCells > 1 ? `<div class="kpi-card"><div class="kpi-val">${d.activeCells}</div><div class="kpi-label">Células Ativas</div></div>` : ''}
            <div class="kpi-card"><div class="kpi-val" style="color: #ea580c;">${d.noVisit}</div><div class="kpi-label">Sem Visita > 60d</div></div>
            <div class="kpi-card"><div class="kpi-val" style="color: #dc2626;">${d.zeroVisits}</div><div class="kpi-label">Nunca Visitados</div></div>
        </div>
    `;

    let tracksHtml = '';
    if (d.tracks && d.tracks.length > 0) {
        tracksHtml = `
            <div class="section-header"><div class="section-title">Saúde Espiritual e Retiros</div></div>
            <div class="bars-grid">
                ${d.tracks.map(t => {
            const count = d.trackCounts[t.id] || 0;
            const pct = d.total ? Math.round(count / d.total * 100) : 0;
            const c = t.color || '#3b82f6';
            const hexMap = { 'primary': '#135bec', 'blue': '#2563eb', 'emerald': '#10b981', 'orange': '#f59e0b', 'purple': '#8b5cf6', 'rose': '#f43f5e', 'amber': '#f59e0b' };
            const hex = hexMap[c] || c;
            return `
                        <div class="bar-container">
                            <div class="bar-header">
                                <span>${t.name}</span>
                                <span>${pct}% <span style="color:#94a3b8; font-weight:400;">(${count}/${d.total})</span></span>
                            </div>
                            <div class="bar-bg"><div class="bar-fill" style="width: ${pct}%; background: ${hex}"></div></div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    }

    // Top Metrics
    let metricsHtml = '';
    if (d.customFieldsConfig && d.customFieldsConfig.length > 0 && d.customFieldTotals) {
        const topMetrics = Object.entries(d.customFieldTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4);

        if (topMetrics.length > 0) {
            metricsHtml = `
                <div class="section-header"><div class="section-title">Indicadores das Células</div></div>
                <div class="kpi-grid">
                    ${topMetrics.map(([k, v]) => `<div class="kpi-card"><div class="kpi-val">${v}</div><div class="kpi-label">${k}</div></div>`).join('')}
                </div>
            `;
        }
    }

    // Insights Automáticos
    const positiveInsights = [];
    const negativeInsights = [];

    if (d.freqPct >= 70) positiveInsights.push(`Excelente média de frequência neste período (${d.freqPct}%).`);
    else if (d.freqPct < 50) negativeInsights.push(`Atenção: A média de frequência das células está abaixo de 50% (${d.freqPct}%).`);

    if (d.visitantes > 0) positiveInsights.push(`Foram cadastrados ${d.visitantes} novos visitantes.`);
    if (d.novosConvertidos > 0) positiveInsights.push(`Tivemos ${d.novosConvertidos} conversões no período.`);

    let zeroVisitsTable = '';
    if (d.zeroVisits > 0 && d.zeroVisitsDetails && d.zeroVisitsDetails.length > 0) {
        const list = d.zeroVisitsDetails.slice(0, 8);
        zeroVisitsTable = `
            <table class="mini-table">
                <thead><tr><th>Nome</th><th>Telefone</th><th>Status</th></tr></thead>
                <tbody>
                    ${list.map(p => `<tr><td><b>${p.name}</b></td><td>${p.phone || '-'}</td><td>${p.status || '-'}</td></tr>`).join('')}
                </tbody>
            </table>
            ${d.zeroVisitsDetails.length > 8 ? `<div style="font-size: 7px; color: #94a3b8; margin-top: 2px;">...e mais ${d.zeroVisitsDetails.length - 8} pessoas.</div>` : ''}
        `;
        negativeInsights.push(`Existem ${d.zeroVisits} membros que nunca foram visitados.`);
    }

    let noVisitsTable = '';
    if (d.noVisit > 0 && d.noVisitDetails && d.noVisitDetails.length > 0) {
        const list = d.noVisitDetails.slice(0, 8);
        noVisitsTable = `
            <table class="mini-table">
                <thead><tr><th>Nome</th><th>Telefone</th><th>Status</th></tr></thead>
                <tbody>
                    ${list.map(p => `<tr><td><b>${p.name}</b></td><td>${p.phone || '-'}</td><td>${p.status || '-'}</td></tr>`).join('')}
                </tbody>
            </table>
            ${d.noVisitDetails.length > 8 ? `<div style="font-size: 7px; color: #94a3b8; margin-top: 2px;">...e mais ${d.noVisitDetails.length - 8} pessoas.</div>` : ''}
        `;
        negativeInsights.push(`${d.noVisit} pessoas estão há mais de 60 dias sem acompanhamento.`);
    }

    if (d.activeCells > 1) positiveInsights.push(`Média de ${d.avgMembers} membros por célula.`);

    const insightsGrid = `
        <div class="section-header"><div class="section-title">Análise & Insights Automáticos</div></div>
        <div class="insights-grid">
            ${positiveInsights.length ? `
                <div class="insight-box blue">
                    <div class="title" style="color:#1d4ed8;">Destaques Positivos</div>
                    <ul>${positiveInsights.map(i => `<li>${i}</li>`).join('')}</ul>
                </div>
            ` : ''}
            
            ${negativeInsights.length ? `
                <div class="insight-box amber">
                    <div class="title" style="color:#b45309;">Pontos de Atenção</div>
                    <ul>${negativeInsights.map(i => `<li>${i}</li>`).join('')}</ul>
                </div>
            ` : ''}

            ${zeroVisitsTable ? `
                <div class="insight-box red">
                    <div class="title" style="color:#b91c1c;">Membros Nunca Visitados (Critico)</div>
                    ${zeroVisitsTable}
                </div>
            ` : ''}

            ${noVisitsTable ? `
                <div class="insight-box amber">
                    <div class="title" style="color:#b45309;">Sem Acompanhamento > 60 Dias</div>
                    ${noVisitsTable}
                </div>
            ` : ''}
        </div>
    `;

    return `
        <div class="section-header"><div class="section-title">Indicadores Principais</div></div>
        ${kpiGrid1}
        ${kpiGrid2}
        ${tracksHtml}
        ${metricsHtml}
        ${insightsGrid}
    `;
}

function renderMembersTable(d) {
    const vc = d.visibleCols || {};
    const tracks = d.tracks || [];

    let th = `<tr>
        <th>Nome</th>
        ${vc.status !== false ? '<th>Status</th>' : ''}
        ${vc.cell !== false ? '<th>Célula</th>' : ''}
        ${vc.phone !== false ? '<th>Telefone</th>' : ''}
        ${tracks.filter(t => vc[t.id] !== false).map(t => `<th class="text-center">${t.name}</th>`).join('')}
        ${vc.visits !== false ? '<th class="text-center">Visitas</th>' : ''}
    </tr>`;

    const statusMap = { 'Novo Convertido': 'badge-green', 'Reconciliação': 'badge-purple', 'Visitante': 'badge-blue', 'Membro': 'badge-gray', 'Inativo': 'badge-gray', 'Afastado': 'badge-orange', 'Mudou-se': 'badge-gray' };

    let trs = d.people.map(p => {
        const c = p.cellName || '—';
        const st = `<span class="badge ${statusMap[p.status] || 'badge-gray'}">${p.status || '—'}</span>`;

        return `<tr>
            <td class="font-bold">${p.name}</td>
            ${vc.status !== false ? `<td>${st}</td>` : ''}
            ${vc.cell !== false ? `<td>${c}</td>` : ''}
            ${vc.phone !== false ? `<td>${p.phone || '—'}</td>` : ''}
            ${tracks.filter(t => vc[t.id] !== false).map(t => {
            const checked = p.tracksData && p.tracksData[t.id];
            return `<td class="text-center" style="color: ${checked ? '#16a34a' : '#94a3b8'}">${checked ? '<b>Sim</b>' : '-'}</td>`;
        }).join('')}
            ${vc.visits !== false ? `<td class="text-center font-bold">${p.visitsCount || 0}</td>` : ''}
        </tr>`;
    }).join('');

    if (!d.people.length) trs = '<tr><td colspan="10" class="text-center">Nenhum membro listado</td></tr>';
    return `<table><thead>${th}</thead><tbody>${trs}</tbody></table>`;
}

function renderCellsTable(d) {
    const showGen = d.showGenerationCol;
    let tableData = [...d.cellsTableData];

    if (showGen) {
        tableData.sort((a, b) => (a.generationName || '').localeCompare(b.generationName || '') || a.name.localeCompare(b.name));
    }

    let th = `<tr>
        <th style="width: 25%;">Célula</th>
        ${showGen ? '<th>Geração</th>' : ''}
        <th>Líder</th>
        <th class="text-center">Dia</th>
        <th class="text-center">Membros</th>
        <th class="text-center">Assiduidade</th>
        <th class="text-center">Reuniões</th>
    </tr>`;

    let trs = tableData.map(c => {
        return `<tr>
            <td class="font-bold">${c.name}</td>
            ${showGen ? `<td><span class="badge badge-gray">${c.generationName || '—'}</span></td>` : ''}
            <td>${c.leader || '—'}</td>
            <td class="text-center">${c.day || '—'}</td>
            <td class="text-center font-bold">${c.memberCount}</td>
            <td class="text-center"><span class="badge ${c.freqPct >= 70 ? 'badge-green' : c.freqPct >= 40 ? 'badge-amber' : 'badge-red'}">${c.freqPct}%</span></td>
            <td class="text-center font-bold" style="color:#059669;">${c.realizadas}</td>
        </tr>`;
    }).join('');

    if (!tableData.length) trs = `<tr><td colspan="${showGen ? 8 : 7}" class="text-center">Nenhuma célula listada</td></tr>`;
    return `<table><thead>${th}</thead><tbody>${trs}</tbody></table>`;
}

function renderVisitsTable(d) {
    if (!d.visitsInPeriod || !d.visitsInPeriod.length) {
        return '<p style="color:#64748b; font-size: 11px; margin-top:10px;">Nenhuma visita contabilizada para os filtros neste período.</p>';
    }

    let th = `<tr><th>Data</th><th>Pessoa / Visitado</th><th>Tipo de Visita</th><th>Resultado</th><th>Anotação do Líder</th></tr>`;

    let trs = d.visitsInPeriod.map(v => {
        return `<tr>
            <td>${v.date}</td>
            <td class="font-bold">${v.personName || '—'}</td>
            <td><span class="badge badge-blue">${v.type || '—'}</span></td>
            <td>${v.result || '—'}</td>
            <td>${v.observation || '—'}</td>
        </tr>`;
    }).join('');

    return `<table><thead>${th}</thead><tbody>${trs}</tbody></table>`;
}

function renderMetricsReport(d) {
    if (!d.customFieldsConfig || d.customFieldsConfig.length === 0) {
        return '<p style="color:#64748b; font-size: 11px; margin-top:10px;">Nenhuma métrica customizada foi configurada neste sistema.</p>';
    }

    // 1. Aggregated Totals
    const sortedTotals = Object.entries(d.customFieldTotals || {}).sort((a, b) => b[1] - a[1]);
    let html = `
        <div style="margin-bottom: 25px;">
            <div style="font-size: 11px; font-weight: 700; color: #1d4ed8; margin-bottom: 10px; text-transform: uppercase;">Resumo Agregado</div>
            <div class="kpi-grid">
                ${sortedTotals.map(([k, v]) => `<div class="kpi-card"><div class="kpi-val">${v}</div><div class="kpi-label">${k}</div></div>`).join('')}
            </div>
        </div>
    `;

    // 2. Chronological History Table
    if (!d.metricsHistory || d.metricsHistory.length === 0) {
        html += '<p style="color:#64748b; font-size: 11px;">Nenhum registro de métrica encontrado no período.</p>';
        return html;
    }

    let th = `<tr>
        <th style="width: 80px;">Data</th>
        <th>Célula / Grupo</th>
        <th>Líder</th>
        ${d.customFieldsConfig.map(c => `<th class="text-center">${c}</th>`).join('')}
    </tr>`;

    let trs = d.metricsHistory.map(m => {
        return `<tr>
            <td style="white-space:nowrap; color:#64748b;">${m.date}</td>
            <td class="font-bold">${m.cellName}</td>
            <td style="color:#64748b;">${m.leaderName}</td>
            ${d.customFieldsConfig.map(c => {
            const val = m.metrics && m.metrics[c] !== undefined ? m.metrics[c] : '-';
            return `<td class="text-center font-bold" style="color:#0f172a;">${val}</td>`;
        }).join('')}
        </tr>`;
    }).join('');

    html += `
        <div style="font-size: 11px; font-weight: 700; color: #1d4ed8; margin-bottom: 10px; text-transform: uppercase;">Histórico de Lançamentos</div>
        <table><thead>${th}</thead><tbody>${trs}</tbody></table>
    `;

    return html;
}

function renderInactiveMembersTable(d) {
    const STATUSES = ['Inativo', 'Afastado', 'Mudou-se'];
    const badgeMap = { 'Inativo': 'badge-gray', 'Afastado': 'badge-orange', 'Mudou-se': 'badge-gray' };
    const people = (d.inativoPeople || []);

    if (!people.length) {
        return '<p style="color:#64748b; font-size: 11px; margin-top:10px;">Nenhum membro inativo, afastado ou que se mudou registrado.</p>';
    }

    // Summary counts
    const counts = STATUSES.map(s => ({ s, n: people.filter(p => p.status === s).length }));
    const summaryKpis = counts.map(({ s, n }) =>
        `<div class="kpi-card"><div class="kpi-val">${n}</div><div class="kpi-label">${s}</div></div>`
    ).join('');

    const th = `<tr>
        <th>Nome</th><th>Status</th><th>Célula</th><th>Telefone</th>
    </tr>`;

    const trs = people.map(p => {
        const badge = badgeMap[p.status] || 'badge-gray';
        return `<tr>
            <td class="font-bold">${p.name}</td>
            <td><span class="badge ${badge}">${p.status}</span></td>
            <td>${p.cellName || '—'}</td>
            <td>${p.phone || '—'}</td>
        </tr>`;
    }).join('');

    return `
        <div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr);">${summaryKpis}</div>
        <table><thead>${th}</thead><tbody>${trs}</tbody></table>
    `;
}

function renderEbdReport(d) {
    // KPIs
    const freqColor = d.freqPct >= 70 ? '#16a34a' : d.freqPct >= 50 ? '#b45309' : '#dc2626';
    const kpis = `
        <div class="kpi-grid">
            <div class="kpi-card"><div class="kpi-val">${d.totalAlunos}</div><div class="kpi-label">Alunos Matr.</div></div>
            <div class="kpi-card"><div class="kpi-val">${d.totalAulas}</div><div class="kpi-label">Aulas no Período</div></div>
            <div class="kpi-card"><div class="kpi-val" style="color:${freqColor}">${d.freqPct}%</div><div class="kpi-label">Freq. Média</div></div>
            <div class="kpi-card"><div class="kpi-val" style="color:#16a34a">R$ ${(d.totalOfferings || 0).toFixed(2).replace('.', ',')}</div><div class="kpi-label">Total Ofertas</div></div>
        </div>`;

    // Classes table
    const classesTh = `<tr><th>Classe</th><th>Professor</th><th class="text-center">Alunos</th><th class="text-center">Aulas</th><th class="text-center">% Presença</th><th class="text-center">Ofertas</th></tr>`;
    const classesTrs = (d.classData || []).length ? (d.classData || []).map(c => {
        const pct = c.totalRec > 0 ? Math.round((c.present / c.totalRec) * 100) : 0;
        const pctColor = pct >= 70 ? '#16a34a' : pct >= 50 ? '#b45309' : '#dc2626';
        return `<tr>
            <td class="font-bold">${c.name}</td>
            <td>${c.professor?.name || '—'}</td>
            <td class="text-center font-bold">${c._count?.students || 0}</td>
            <td class="text-center">${c.aulas}</td>
            <td class="text-center"><span class="badge" style="background:${pct >= 70 ? '#dcfce7' : pct >= 50 ? '#fef3c7' : '#fee2e2'};color:${pctColor}">${pct}%</span></td>
            <td class="text-center" style="color:#16a34a;font-weight:700;">R$ ${c.offerings.toFixed(2).replace('.', ',')}</td>
        </tr>`;
    }).join('') : '<tr><td colspan="6" class="text-center">Nenhuma classe no período</td></tr>';

    // Students frequency table
    const alunosTh = `<tr><th>#</th><th>Aluno</th><th>Classe</th><th class="text-center">Presenças</th><th class="text-center">Total</th><th class="text-center">% Freq.</th></tr>`;
    const sorted = [...(d.studentsArr || [])].sort((a, b) => {
        const pa = a.total > 0 ? a.present / a.total : 0;
        const pb = b.total > 0 ? b.present / b.total : 0;
        return pb - pa;
    });
    const alunosTrs = sorted.length ? sorted.map((p, i) => {
        const pct = p.total > 0 ? Math.round((p.present / p.total) * 100) : 0;
        const pctColor = pct >= 70 ? '#16a34a' : pct >= 50 ? '#b45309' : '#dc2626';
        return `<tr>
            <td style="color:#94a3b8;width:25px">${i + 1}</td>
            <td class="font-bold">${p.name}</td>
            <td style="color:#64748b">${p.classe}</td>
            <td class="text-center font-bold">${p.present}</td>
            <td class="text-center" style="color:#94a3b8">${p.total}</td>
            <td class="text-center"><span class="badge" style="background:${pct >= 70 ? '#dcfce7' : pct >= 50 ? '#fef3c7' : '#fee2e2'};color:${pctColor}">${pct}%</span></td>
        </tr>`;
    }).join('') : '<tr><td colspan="6" class="text-center">Nenhum dado de frequência no período</td></tr>';

    // Low frequency insights
    const lowFreq = sorted.filter(p => p.total > 0 && Math.round((p.present / p.total) * 100) < 50);
    const insightsHtml = lowFreq.length ? `
        <div class="section-header"><div class="section-title">Alerta de Frequência</div></div>
        <div class="insight-box amber" style="margin-bottom:15px">
            <div class="title" style="color:#b45309;">Alunos com Frequência Abaixo de 50%</div>
            <table class="mini-table"><thead><tr><th>Aluno</th><th>Classe</th><th>Presenças / Total</th><th>Frequência</th></tr></thead><tbody>
                ${lowFreq.slice(0, 15).map(p => {
                    const pct = Math.round((p.present / p.total) * 100);
                    return `<tr><td><b>${p.name}</b></td><td>${p.classe}</td><td>${p.present}/${p.total}</td><td style="color:#dc2626;font-weight:700">${pct}%</td></tr>`;
                }).join('')}
            </tbody></table>
            ${lowFreq.length > 15 ? `<div style="font-size:7px;color:#94a3b8;margin-top:3px">...e mais ${lowFreq.length - 15} alunos.</div>` : ''}
        </div>` : '';

    return `
        <div class="section-header"><div class="section-title">Indicadores do Período</div></div>
        ${kpis}
        <div class="section-header"><div class="section-title">Desempenho por Classe</div></div>
        <table><thead>${classesTh}</thead><tbody>${classesTrs}</tbody></table>
        ${insightsHtml}
        <div class="section-header"><div class="section-title">Frequência por Aluno</div></div>
        <table><thead>${alunosTh}</thead><tbody>${alunosTrs}</tbody></table>
    `;
}

function renderEbdClassReport(d) {
    // Class summary KPIs
    const freqColor = d.freqPct >= 70 ? '#16a34a' : d.freqPct >= 50 ? '#b45309' : '#dc2626';
    const kpis = `
        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
            <div class="kpi-card"><div class="kpi-val">${d.totalAlunos}</div><div class="kpi-label">Alunos</div></div>
            <div class="kpi-card"><div class="kpi-val">${d.totalAulas}</div><div class="kpi-label">Aulas</div></div>
            <div class="kpi-card"><div class="kpi-val" style="color:${freqColor}">${d.freqPct}%</div><div class="kpi-label">Freq. Média</div></div>
        </div>`;

    const classInfoHtml = `
        <div style="margin-bottom:15px;padding:10px 12px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;font-size:9px;color:#475569">
            ${d.professor ? `<span style="margin-right:16px"><b>Professor:</b> ${d.professor}</span>` : ''}
            ${d.segundoProfessor ? `<span style="margin-right:16px"><b>2º Professor:</b> ${d.segundoProfessor}</span>` : ''}
            ${d.terceiroProfessor ? `<span style="margin-right:16px"><b>3º Professor:</b> ${d.terceiroProfessor}</span>` : ''}
            ${d.sala ? `<span style="margin-right:16px"><b>Sala:</b> ${d.sala}</span>` : ''}
            ${d.faixaEtaria ? `<span><b>Faixa etária:</b> ${d.faixaEtaria}</span>` : ''}
        </div>`;

    // Attendance calendar-style: one row per attendance date
    const attHistTh = `<tr><th>Data</th><th class="text-center">Presentes</th><th class="text-center">Total</th><th class="text-center">% Presença</th></tr>`;
    const attHistTrs = (d.attendanceHistory || []).length ? (d.attendanceHistory || []).map(att => {
        const pctColor = att.pct >= 70 ? '#16a34a' : att.pct >= 50 ? '#b45309' : '#dc2626';
        return `<tr>
            <td class="font-bold">${att.data}</td>
            <td class="text-center font-bold">${att.present}</td>
            <td class="text-center" style="color:#94a3b8">${att.total}</td>
            <td class="text-center"><span class="badge" style="background:${att.pct >= 70 ? '#dcfce7' : att.pct >= 50 ? '#fef3c7' : '#fee2e2'};color:${pctColor}">${att.pct}%</span></td>
        </tr>`;
    }).join('') : '<tr><td colspan="4" class="text-center">Nenhuma chamada registrada</td></tr>';

    // Students frequency table
    const stuTh = `<tr><th>#</th><th>Aluno</th><th class="text-center">Presenças</th><th class="text-center">Total</th><th class="text-center">Faltas</th><th class="text-center">% Freq.</th></tr>`;
    const sorted = [...(d.studentsFreq || [])].sort((a, b) => (b.pct - a.pct) || a.name.localeCompare(b.name));
    const stuTrs = sorted.length ? sorted.map((s, i) => {
        const pctColor = s.pct >= 70 ? '#16a34a' : s.pct >= 50 ? '#b45309' : '#dc2626';
        return `<tr>
            <td style="color:#94a3b8;width:25px">${i + 1}</td>
            <td class="font-bold">${s.name}</td>
            <td class="text-center font-bold" style="color:#16a34a">${s.present}</td>
            <td class="text-center" style="color:#94a3b8">${s.total}</td>
            <td class="text-center" style="color:#dc2626">${s.total - s.present}</td>
            <td class="text-center"><span class="badge" style="background:${s.pct >= 70 ? '#dcfce7' : s.pct >= 50 ? '#fef3c7' : '#fee2e2'};color:${pctColor}">${s.pct}%</span></td>
        </tr>`;
    }).join('') : '<tr><td colspan="6" class="text-center">Nenhum aluno matriculado</td></tr>';

    return `
        ${classInfoHtml}
        <div class="section-header"><div class="section-title">Indicadores da Classe</div></div>
        ${kpis}
        <div class="section-header"><div class="section-title">Frequência por Aluno</div></div>
        <table><thead>${stuTh}</thead><tbody>${stuTrs}</tbody></table>
        <div class="section-header"><div class="section-title">Histórico de Chamadas</div></div>
        <table><thead>${attHistTh}</thead><tbody>${attHistTrs}</tbody></table>
    `;
}

function renderEbdPeopleReport(d) {
    const rows = d.rows || [];
    const vc = d.visibleCols || {};
    const roleColors = {
        'Professor':     { bg: '#dbeafe', color: '#1d4ed8' },
        '2º Professor':  { bg: '#e0e7ff', color: '#4338ca' },
        'Aluno':         { bg: '#dcfce7', color: '#15803d' },
    };

    // Summary
    const profCount   = rows.filter(r => r.role === 'Professor').length;
    const prof2Count  = rows.filter(r => r.role === '2º Professor').length;
    const alunoCount  = rows.filter(r => r.role === 'Aluno').length;

    const kpis = `
        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
            <div class="kpi-card"><div class="kpi-val" style="color:#1d4ed8">${profCount}</div><div class="kpi-label">Professores</div></div>
            <div class="kpi-card"><div class="kpi-val" style="color:#4338ca">${prof2Count}</div><div class="kpi-label">2º Professores</div></div>
            <div class="kpi-card"><div class="kpi-val" style="color:#15803d">${alunoCount}</div><div class="kpi-label">Alunos</div></div>
        </div>`;

    // Build header columns based on visibleCols
    const th = `<tr>
        <th>#</th>
        <th>Nome</th>
        ${vc.perfil !== false ? '<th>Perfil</th>' : ''}
        ${vc.turma !== false ? '<th>Turma / Classe</th>' : ''}
        ${vc.telefone !== false ? '<th>Telefone</th>' : ''}
        ${vc.status_pessoa !== false ? '<th>Status</th>' : ''}
        ${vc.frequencia !== false ? '<th class="text-center">Frequência</th>' : ''}
    </tr>`;

    const trs = rows.length ? rows.map((r, i) => {
        const rc = roleColors[r.role] || { bg: '#f1f5f9', color: '#475569' };
        const freqHtml = r.freq !== null && r.freq !== undefined
            ? `<span class="badge" style="background:${r.freq >= 70 ? '#dcfce7' : r.freq >= 50 ? '#fef3c7' : '#fee2e2'};color:${r.freq >= 70 ? '#15803d' : r.freq >= 50 ? '#b45309' : '#b91c1c'}">${r.freq}%</span>`
            : '<span style="color:#94a3b8">—</span>';
        return `<tr>
            <td style="color:#94a3b8;width:25px">${i + 1}</td>
            <td class="font-bold">${r.name}</td>
            ${vc.perfil !== false ? `<td><span class="badge" style="background:${rc.bg};color:${rc.color}">${r.role}</span></td>` : ''}
            ${vc.turma !== false ? `<td style="color:#64748b">${r.classe}</td>` : ''}
            ${vc.telefone !== false ? `<td style="color:#64748b">${r.phone || '—'}</td>` : ''}
            ${vc.status_pessoa !== false ? `<td style="color:#64748b">${r.status || '—'}</td>` : ''}
            ${vc.frequencia !== false ? `<td class="text-center">${freqHtml}</td>` : ''}
        </tr>`;
    }).join('') : `<tr><td colspan="7" class="text-center">Nenhuma pessoa encontrada</td></tr>`;

    return `
        <div class="section-header"><div class="section-title">Resumo</div></div>
        ${kpis}
        <div class="section-header"><div class="section-title">Lista Completa (${rows.length} pessoas)</div></div>
        <table><thead>${th}</thead><tbody>${trs}</tbody></table>
    `;
}

function renderFinanceReport(d) {
    const fmtBRL = v => 'R$ ' + (Number(v || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    // KPIs Grid
    const kpis = `
        <div class="kpi-grid">
            <div class="kpi-card"><div class="kpi-val" style="color:#16a34a">${fmtBRL(d.entradaMes)}</div><div class="kpi-label">Total Receitas</div></div>
            <div class="kpi-card"><div class="kpi-val" style="color:#dc2626">${fmtBRL(d.saidaMes)}</div><div class="kpi-label">Total Despesas</div></div>
            <div class="kpi-card"><div class="kpi-val" style="color:${(d.resultadoMes || 0) >= 0 ? '#16a34a' : '#dc2626'}">${fmtBRL(d.resultadoMes)}</div><div class="kpi-label">Resultado</div></div>
            <div class="kpi-card"><div class="kpi-val" style="color:#2563eb">${fmtBRL(d.saldoTotal)}</div><div class="kpi-label">Saldo em Caixa</div></div>
        </div>`;

    // Chart Section
    let chartHtml = '';
    if (d.chartImage) {
        chartHtml = `
            <div class="section-header"><div class="section-title">Evolução do Período</div></div>
            <div style="text-align:center; margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius:12px; padding: 15px;">
                <img src="${d.chartImage}" style="max-width: 100%; height: auto; max-height: 250px;" />
            </div>`;
    }

    // accounts table
    const accTh = `<tr><th>Conta Bancária / Caixa</th><th class="text-center">Tipo</th><th class="text-right">Saldo Atual</th></tr>`;
    const accTrs = (d.saldoPorConta || []).map(acc => `
        <tr>
            <td class="font-bold">${acc.name}</td>
            <td class="text-center">${acc.type}</td>
            <td class="text-right font-bold ${acc.balance >= 0 ? 'badge-green' : 'badge-red'}" style="background:transparent">${fmtBRL(acc.balance)}</td>
        </tr>`).join('');

    // DRE Sections
    const renderDreRows = (items, colorClass) => {
        if (!items || !items.length) return '<tr><td colspan="2" class="text-center" style="color:#94a3b8">Nenhum lançamento</td></tr>';
        return items.map(it => `
            <tr>
                <td style="font-weight:500">${it.name}</td>
                <td class="text-right font-bold ${colorClass}">${fmtBRL(it.amount)}</td>
            </tr>`).join('');
    };

    const dreReceitas = renderDreRows(d.dre?.receitas || d.dre?.incomeCategories, 'text-emerald-600');
    const dreDespesas = renderDreRows(d.dre?.despesas || d.dre?.expenseCategories, 'text-red-600');

    return `
        <div class="section-header"><div class="section-title">Resumo Gerencial</div></div>
        ${kpis}
        ${chartHtml}
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start;">
            <div>
                <div class="section-header"><div class="section-title">Receitas por Categoria</div></div>
                <table>
                    <thead><tr><th>Categoria</th><th class="text-right">Valor</th></tr></thead>
                    <tbody>${dreReceitas}</tbody>
                </table>
            </div>
            <div>
                <div class="section-header"><div class="section-title">Despesas por Categoria</div></div>
                <table>
                    <thead><tr><th>Categoria</th><th class="text-right">Valor</th></tr></thead>
                    <tbody>${dreDespesas}</tbody>
                </table>
            </div>
        </div>

        <div class="section-header"><div class="section-title">Saldos por Conta</div></div>
        <table><thead>${accTh}</thead><tbody>${accTrs}</tbody></table>

        <div style="margin-top:20px; padding: 15px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; display:flex; justify-content: space-between; align-items: center;">
            <span style="font-size:12px; font-weight:800; color:#0f172a">RESULTADO OPERACIONAL LÍQUIDO NO PERÍODO</span>
            <span style="font-size:16px; font-weight:800; color:${(d.resultadoMes || 0) >= 0 ? '#10b981' : '#ef4444'}">${fmtBRL(d.resultadoMes)}</span>
        </div>
    `;
}

module.exports = {
    generatePDF
};
