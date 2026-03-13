const express = require('express');
const router = express.Router();

const { hasFinanceAccess, hasFinanceAdminAccess } = require('../../lib/financeAccess');

const accountsRouter = require('./accounts');
const fundsRouter    = require('./funds');
const chartRouter    = require('./chart');

router.use('/accounts', accountsRouter);
router.use('/funds',    fundsRouter);
router.use('/chart',    chartRouter);

const transactionsRouter = require('./transactions');
router.use('/transactions', transactionsRouter);

const donationsRouter = require('./donations');
const billsRouter     = require('./bills');

router.use('/donations', donationsRouter);
router.use('/bills',     billsRouter);

const reportsRouter = require('./reports');
router.use('/reports', reportsRouter);

router.get('/health', (req, res) => {
    if (!hasFinanceAccess(req)) return res.status(403).json({ error: 'Sem acesso ao módulo financeiro' });
    res.json({ ok: true, module: 'finance' });
});

module.exports = { financeRouter: router, hasFinanceAccess, hasFinanceAdminAccess };
