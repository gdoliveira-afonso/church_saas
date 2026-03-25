// ----------------------------------------------------------------------------
// ipBlock — middleware de bloqueio por IP (atualmente desabilitado)
// Acesso via IP direto é permitido para troubleshooting/diagnóstico.
// O backend resolve IPs para a org "matriz" automaticamente.
// Para reabilitar o bloqueio: restaure o return 403 abaixo.
// ----------------------------------------------------------------------------
module.exports = function ipBlock(req, res, next) {
    next();
};
