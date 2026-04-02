const prisma = require('../lib/prisma');
const { sendWebhookRequest } = require('../api/controllers/webhooksController');

// Intervalos de retry (ms): 1min, 5min, 30min, 2h, 5h
const RETRY_INTERVALS = [60_000, 300_000, 1_800_000, 7_200_000, 18_000_000];
const MAX_ATTEMPTS = RETRY_INTERVALS.length;

async function processRetries() {
    try {
        const now = new Date();
        const deliveries = await prisma.webhookDelivery.findMany({
            where: { status: 'pending', nextRetryAt: { lte: now } },
            include: { webhook: true },
            take: 50
        });

        for (const delivery of deliveries) {
            const wh = delivery.webhook;
            const payload = JSON.parse(delivery.payload);

            const result = await sendWebhookRequest(wh.url, wh.secret, payload);

            const newAttempts = delivery.attempts + 1;

            if (result.success) {
                await prisma.webhookDelivery.update({
                    where: { id: delivery.id },
                    data: { status: 'delivered', attempts: newAttempts, lastStatusCode: result.statusCode, lastError: null }
                });
                await prisma.webhookLog.create({
                    data: {
                        webhookId: wh.id,
                        event: delivery.event,
                        statusCode: result.statusCode,
                        responseTime: result.responseTime,
                        success: true
                    }
                }).catch(() => {});
            } else if (newAttempts >= MAX_ATTEMPTS) {
                await prisma.webhookDelivery.update({
                    where: { id: delivery.id },
                    data: {
                        status: 'failed',
                        attempts: newAttempts,
                        lastStatusCode: result.statusCode,
                        lastError: `HTTP ${result.statusCode} após ${newAttempts} tentativas`
                    }
                });
            } else {
                const nextRetryAt = new Date(Date.now() + RETRY_INTERVALS[newAttempts]);
                await prisma.webhookDelivery.update({
                    where: { id: delivery.id },
                    data: {
                        attempts: newAttempts,
                        nextRetryAt,
                        lastStatusCode: result.statusCode,
                        lastError: `HTTP ${result.statusCode}`
                    }
                });
            }
        }
    } catch (err) {
        console.error('[WebhookRetry] Erro ao processar retries:', err.message);
    }
}

function startRetryJob() {
    console.log('[WebhookRetry] Job de retry iniciado (intervalo: 30s)');
    setInterval(processRetries, 30_000);
}

module.exports = { startRetryJob, processRetries };
