# SGI

![Versão](https://img.shields.io/badge/versão-1.1-blue)
![Stack](https://img.shields.io/badge/stack-Express%20%2B%20Vite%20%2B%20Prisma-informational)
![Banco](https://img.shields.io/badge/banco-PostgreSQL%20%2F%20SQLite-lightgrey)
![Deploy](https://img.shields.io/badge/deploy-Docker-2496ED)

SaaS multitenancy para gestão de membros, células e escola bíblica de igrejas. Cada organização opera em seu próprio slug/subdomínio, com módulos ativáveis por organização (Células, EBD, Financeiro).

---

## Stack Técnica

| Camada       | Tecnologia                                                  |
|--------------|-------------------------------------------------------------|
| Frontend     | Vanilla JS + Vite 7 + Tailwind CSS 4 (CDN), SPA hash-router |
| Backend      | Express.js 5 + Prisma 5 ORM + JWT + Bcrypt                  |
| Banco (dev)  | SQLite                                                       |
| Banco (prod) | PostgreSQL 16                                                |
| Deploy       | Docker + Nginx reverse proxy                                 |
| PDF          | Puppeteer                                                    |
| Export       | SheetJS / XLSX                                               |
| PWA          | Service Worker                                               |
| Segurança    | Helmet, CORS restrito, rate limiting, API keys (hashed)      |

---

## Estrutura de Pastas

```
/
├── src/                        # Frontend (Vite SPA)
│   ├── app.js                  # Entry point + definição de rotas + guards
│   ├── router.js               # Hash-based router
│   ├── store.js                # Estado global (Store class)
│   ├── views/                  # Componentes de página
│   └── components/ui.js        # Utilitários de UI compartilhados
├── index.html                  # Shell HTML principal
├── vite.config.js
├── nginx.conf                  # Nginx reverse proxy (HTTP + HTTPS comentado)
├── docker-compose.yml          # Orquestração: postgres + backend + frontend
├── Dockerfile                  # Build da imagem frontend
├── install.sh                  # Script de instalação rápida (Linux/Mac)
└── server/                     # Backend (Express)
    ├── index.js                # Entry point do servidor
    ├── prisma/
    │   ├── schema.prisma       # Schema do banco (sqlite dev / postgresql prod)
    │   └── migrations/         # Histórico de migrações
    ├── routes/                 # Rotas REST
    │   ├── people.js           # Pessoas/membros
    │   ├── cells.js            # Células
    │   ├── users.js            # Usuários + RBAC
    │   ├── generations.js      # Gerações
    │   ├── events.js           # Eventos + recorrência
    │   ├── forms.js            # Formulários dinâmicos + TriageQueue
    │   ├── reports.js          # Relatórios gerais
    │   ├── settings.js         # Configurações da organização
    │   ├── admin.js            # Superadmin + backup
    │   ├── ebd.js              # Módulo EBD completo
    │   ├── logs.js             # ActivityLog / auditoria
    │   └── finance/            # Módulo financeiro
    │       ├── index.js        # Guard + roteador base
    │       ├── accounts.js     # Contas bancárias
    │       ├── funds.js        # Fundos
    │       ├── chart.js        # Plano de contas
    │       ├── transactions.js # Ledger central
    │       ├── donations.js    # Dízimos e ofertas
    │       ├── bills.js        # Contas a pagar
    │       └── reports.js      # Relatórios financeiros
    ├── middleware/
    │   ├── activityLogger.js   # Auditoria automática de ações
    │   ├── ebdGuard.js         # Guards de acesso ao módulo EBD
    │   ├── financeGuard.js     # Guards de acesso ao módulo financeiro
    │   └── cellsGuard.js       # Guard do módulo células
    └── lib/
        ├── prisma.js           # Singleton PrismaClient
        ├── planLimits.js       # Limites por plano (demo / normal)
        └── financeSeeds.js     # Seed financeiro idempotente
```

---

## Como Rodar Localmente

### Pré-requisitos

- Node.js 20+
- npm

### Backend

```bash
cd server

# Configure o .env
cp .env.example .env
# Edite e defina JWT_SECRET e DATABASE_URL

# Para SQLite (dev), edite server/prisma/schema.prisma:
#   provider = "sqlite"
# e defina no .env:
#   DATABASE_URL="file:./prisma/dev.db"

npm install
npx prisma generate
node index.js
```

> IMPORTANTE: No Windows, o processo node bloqueia o arquivo `.dll` do Prisma.
> Pare o servidor antes de rodar `npx prisma generate` ou `prisma db push`.

### Frontend

Em outro terminal, na raiz do projeto:

```bash
npm install
npm run dev
# Vite faz proxy de /api → localhost:3000 automaticamente
```

### Via Docker (recomendado para produção)

```bash
# Instalação rápida (Linux/Mac)
chmod +x install.sh
./install.sh
docker-compose up -d

# Ou manualmente
cp .env.example .env
# Edite .env e defina pelo menos JWT_SECRET e SUPERADMIN_PASSWORD
docker-compose up -d
```

A aplicação ficará acessível em `http://localhost`.

---

## Variáveis de Ambiente

| Variável               | Obrigatória | Descrição                                                              |
|------------------------|-------------|------------------------------------------------------------------------|
| `JWT_SECRET`           | **Sim**     | Chave secreta JWT. Gere com `openssl rand -hex 32`. Server recusa iniciar sem ela. |
| `DATABASE_URL`         | Sim (prod)  | Connection string PostgreSQL. Ex: `postgresql://user:pass@host:5432/db` |
| `SUPERADMIN_PASSWORD`  | **Sim**     | Senha do usuário superadmin (sem fallback hardcoded por segurança).    |
| `SUPERADMIN_USERNAME`  | Não         | Username do superadmin. Padrão: `superadmin`                           |
| `PORT`                 | Não         | Porta do backend. Padrão: `3000`                                       |
| `POSTGRES_USER`        | Não         | Usuário do PostgreSQL. Padrão: `crm`                                   |
| `POSTGRES_PASSWORD`    | Não         | Senha do PostgreSQL. Padrão: `crm_password`                            |
| `POSTGRES_DB`          | Não         | Nome do banco. Padrão: `church_crm`                                    |
| `SAAS_DOMAIN`          | Não         | Domínio base para resolução multitenancy por subdomínio                |
| `ALLOWED_ORIGINS`      | Prod        | Origens CORS permitidas, separadas por vírgula                         |

### Exemplo de `.env`

```env
JWT_SECRET=troque_por_valor_gerado_com_openssl_rand_hex_32
SUPERADMIN_PASSWORD=senha_segura_aqui
DATABASE_URL=postgresql://crm:crm_password@postgres:5432/church_crm
POSTGRES_USER=crm
POSTGRES_PASSWORD=crm_password
POSTGRES_DB=church_crm
ALLOWED_ORIGINS=https://minha-igreja.com.br,https://outra.com.br
```

---

## Credenciais Padrão (desenvolvimento)

| Usuário   | Senha    | Role      |
|-----------|----------|-----------|
| `admin`   | `123456` | ADMIN     |

> Altere as credenciais imediatamente em qualquer ambiente acessível externamente.

---

## Documentação Adicional

- [Perfis e Permissões](docs/ROLES.md)
- [Módulos do Sistema](docs/MODULES.md)
- [Guia de Deploy](docs/DEPLOY.md)
