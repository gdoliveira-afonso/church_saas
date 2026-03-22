// ----------------------------------------------------------------------------
// ipBlock — bloqueia acesso direto via IP puro (ex: 192.168.1.1, 10.0.0.1)
// Registrar antes de todas as rotas de API no server/index.js.
// Exceção: /api/health (health checks de Docker / load balancer).
// ----------------------------------------------------------------------------
module.exports = function ipBlock(req, res, next) {
    // Health check sempre liberado (Docker, load balancer, uptime monitors)
    if (req.path === '/api/health') return next();

    const rawHost = req.headers['x-forwarded-host'] || req.headers['host'] || '';
    const hostname = rawHost.split(':')[0].toLowerCase().trim();

    if (hostname && /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
        // Loopback: localhost/dev (Vite proxy envia host: 127.0.0.1) — sempre permitido
        if (hostname === '127.0.0.1' || hostname === '::1') return next();
        return res.status(403).json({
            error: 'IP_BLOCKED',
            message: 'Acesso direto via IP não é permitido. Use o domínio da sua organização.'
        });
    }

    next();
};
