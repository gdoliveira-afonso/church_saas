/**
 * finance-methods.js — Métodos do Store relacionados ao módulo financeiro.
 * Aplicado via Object.assign(Store.prototype, financeMethods) em store.js.
 */

export const financeMethods = {
    // ── Contas ──────────────────────────────────────────────────────────────
    async fetchFinanceAccounts() {
        this.financeAccounts = await this.apiFetch('/finance/accounts').catch(() => []);
    },

    // ── Fundos ───────────────────────────────────────────────────────────────
    async fetchFinanceFunds() {
        this.financeFunds = await this.apiFetch('/finance/funds').catch(() => []);
    },

    // ── Plano de Contas ──────────────────────────────────────────────────────
    async fetchFinanceChart() {
        this.financeChartOfAccounts = await this.apiFetch('/finance/chart').catch(() => []);
    },

    async addFinanceChartCategory(data) {
        const res = await this.apiFetch('/finance/chart', { method: 'POST', body: JSON.stringify(data) });
        await this.fetchFinanceChart();
        return res;
    },

    async updateFinanceChartCategory(id, data) {
        const res = await this.apiFetch(`/finance/chart/${id}`, { method: 'PUT', body: JSON.stringify(data) });
        await this.fetchFinanceChart();
        return res;
    },

    async toggleFinanceChartCategory(id) {
        const res = await this.apiFetch(`/finance/chart/${id}/toggle`, { method: 'PATCH' });
        await this.fetchFinanceChart();
        return res;
    },
};
