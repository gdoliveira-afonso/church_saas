const express = require('express');
const router = express.Router();
const { apiAuth } = require('../../middleware/apiAuth');

// Importa rotas v1
const membrosRouter = require('./membros');
const eventosRouter = require('./eventos');
const frequenciasRouter = require('./frequencias');
const turmasRouter = require('./turmas');

// Todos os endpoints v1 exigem apiAuth
router.use(apiAuth);

router.use('/membros', membrosRouter);
router.use('/eventos', eventosRouter);
router.use('/frequencias', frequenciasRouter);
router.use('/turmas', turmasRouter);

// Info da API
router.get('/', (req, res) => {
    res.json({
        success: true,
        api: 'SGI Public API',
        version: 'v1',
        endpoints: [
            'GET /api/v1/membros',
            'GET /api/v1/membros/:id',
            'POST /api/v1/membros',
            'PUT /api/v1/membros/:id',
            'DELETE /api/v1/membros/:id',
            'GET /api/v1/eventos',
            'POST /api/v1/eventos',
            'GET /api/v1/frequencias',
            'GET /api/v1/turmas',
        ]
    });
});

module.exports = router;
