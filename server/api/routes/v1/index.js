const express = require('express');
const router = express.Router();
const { apiAuth } = require('../../middleware/apiAuth');

// Importa rotas v1
const membrosRouter = require('./membros');
const eventosRouter = require('./eventos');
const frequenciasRouter = require('./frequencias');
const turmasRouter = require('./turmas');
const celulasRouter = require('./celulas');
const aniversariantesRouter = require('./aniversariantes');
const financeiroRouter = require('./financeiro');
const ebdApiRouter = require('./ebd-api');
const statsRouter = require('./stats');

// Todos os endpoints v1 exigem apiAuth
router.use(apiAuth);

router.use('/membros', membrosRouter);
router.use('/eventos', eventosRouter);
router.use('/frequencias', frequenciasRouter);
router.use('/turmas', turmasRouter);
router.use('/celulas', celulasRouter);
router.use('/aniversariantes', aniversariantesRouter);
router.use('/financeiro', financeiroRouter);
router.use('/ebd', ebdApiRouter);
router.use('/stats', statsRouter);

// Info da API
router.get('/', (req, res) => {
    res.json({
        success: true,
        api: 'CRM Celular Public API',
        version: 'v1',
        endpoints: [
            'GET  /api/v1/membros',
            'GET  /api/v1/membros/:id',
            'POST /api/v1/membros',
            'PUT  /api/v1/membros/:id',
            'DELETE /api/v1/membros/:id',
            'GET  /api/v1/eventos',
            'POST /api/v1/eventos',
            'PUT  /api/v1/eventos/:id',
            'DELETE /api/v1/eventos/:id',
            'GET  /api/v1/frequencias',
            'GET  /api/v1/turmas',
            'GET  /api/v1/celulas',
            'GET  /api/v1/celulas/:id',
            'GET  /api/v1/celulas/:id/membros',
            'GET  /api/v1/aniversariantes?when=today|tomorrow|week',
            'GET  /api/v1/financeiro/doacoes',
            'GET  /api/v1/ebd/turmas',
            'GET  /api/v1/ebd/turmas/:id/chamadas',
            'GET  /api/v1/stats',
        ]
    });
});

module.exports = router;
