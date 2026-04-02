const express = require('express');
const router = express.Router();
const { listWebhooks, createWebhook, updateWebhook, deleteWebhook, getWebhookLogs, listWebhookDeliveries, redeliverWebhook, testWebhook } = require('../controllers/webhooksController');

router.get('/', listWebhooks);
router.post('/', createWebhook);
router.put('/:id', updateWebhook);
router.delete('/:id', deleteWebhook);
router.get('/:id/logs', getWebhookLogs);
router.get('/:id/deliveries', listWebhookDeliveries);
router.post('/:id/test', testWebhook);
router.post('/:id/deliveries/:deliveryId/redeliver', redeliverWebhook);

module.exports = router;
