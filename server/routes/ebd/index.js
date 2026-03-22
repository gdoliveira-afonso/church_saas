/**
 * server/routes/ebd/index.js
 * Ponto de entrada do módulo EBD — monta sub-routers por domínio.
 * Montado em server/index.js via: app.use('/api/ebd', ..., require('./routes/ebd'))
 *
 * Estrutura:
 *   classes.js    — CRUD de classes (/classes, /classes/:id)
 *   students.js   — Alunos (/students/all, /classes/:id/students)
 *   attendance.js — Chamada (/classes/:id/attendance, /attendance/all)
 *   offerings.js  — Ofertas (/classes/:id/offerings, /offerings/all)
 *   person.js     — Resumo individual (/person/:personId)
 *   reports.js    — Relatórios e limpeza (/reports/summary, /all-data)
 */
const express = require('express');
const router = express.Router();

router.use(require('./classes'));
router.use(require('./students'));
router.use(require('./attendance'));
router.use(require('./offerings'));
router.use(require('./person'));
router.use(require('./reports'));

module.exports = router;
