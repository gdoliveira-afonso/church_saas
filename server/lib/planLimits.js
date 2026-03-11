// Módulo central de limites por plano
// Planos: 'demo' (max 2 células) | 'normal' (ilimitado)

const PLANOS = {
    demo: {
        label: 'Demo',
        maxCelulas: 2
    },
    normal: {
        label: 'Normal',
        maxCelulas: Infinity
    }
};

function getLimites(plan) {
    return PLANOS[plan] || PLANOS.demo;
}

function atingiuLimiteCelulas(plan, count) {
    const limites = getLimites(plan);
    return limites.maxCelulas !== Infinity && count >= limites.maxCelulas;
}

const PLANOS_VALIDOS = Object.keys(PLANOS);

module.exports = { getLimites, atingiuLimiteCelulas, PLANOS_VALIDOS };
