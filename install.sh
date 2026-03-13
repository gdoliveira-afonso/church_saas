#!/bin/bash
# ============================================================
# CRM Gestão Celular SaaS — Instalador Automatizado
# ============================================================
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

divider() { echo -e "${BLUE}────────────────────────────────────────────────${NC}"; }
step()    { echo -e "\n${BOLD}${BLUE}▶ $1${NC}"; }
ok()      { echo -e "${GREEN}✔ $1${NC}"; }
warn()    { echo -e "${YELLOW}⚠ $1${NC}"; }
err()     { echo -e "${RED}✖ $1${NC}"; }

divider
echo -e "${BOLD}${BLUE}   CRM Gestão Celular SaaS — Instalador v3.0   ${NC}"
divider
echo ""

# ─── 1. Verificação de Dependências ────────────────────────
step "Verificando dependências..."

HAS_NODE=0; HAS_DOCKER=0; HAS_PM2=0; HAS_OPENSSL=0

command -v node   &>/dev/null && { ok "Node.js $(node -v)"; HAS_NODE=1; } || warn "Node.js não encontrado — necessário para modo local"
command -v docker &>/dev/null && { ok "Docker $(docker --version | head -1)"; HAS_DOCKER=1; } || warn "Docker não encontrado — necessário para modo containerizado"
command -v pm2    &>/dev/null && { ok "PM2 $(pm2 -v)"; HAS_PM2=1; }
command -v openssl &>/dev/null && HAS_OPENSSL=1

echo ""

# ─── 2. Modo de Execução ───────────────────────────────────
step "Modo de Execução"
echo "  1) Node.js nativo (+ PM2) — Servidor Linux/VPS diretamente"
echo "  2) Docker + Docker Compose — Containerizado (recomendado)"
echo ""
read -p "Escolha [1 ou 2]: " RUN_MODE

if [ "$RUN_MODE" == "1" ] && [ "$HAS_NODE" == "0" ]; then
  err "Node.js é obrigatório no modo local. Instale com: curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install nodejs"
  exit 1
fi
if [ "$RUN_MODE" == "2" ] && [ "$HAS_DOCKER" == "0" ]; then
  err "Docker é obrigatório no modo containerizado. Instale em: https://docs.docker.com/engine/install/"
  exit 1
fi

# Detecta o comando docker compose (compatível com v1 e v2)
if command -v docker-compose &>/dev/null; then
  DOCKER_CMD="docker-compose"
else
  DOCKER_CMD="docker compose"
fi

# ─── 2.1 Limpeza de Instalação Anterior ────────────────────
step "Limpando instalação anterior..."

if [ "$RUN_MODE" == "2" ]; then
  # Para e remove containers existentes do projeto
  if $DOCKER_CMD ps -q 2>/dev/null | grep -q .; then
    warn "Containers em execução detectados. Parando..."
    $DOCKER_CMD down --remove-orphans 2>/dev/null || true
    ok "Containers parados e removidos"
  else
    $DOCKER_CMD down --remove-orphans 2>/dev/null || true
  fi

  # Pergunta se deseja apagar os dados do banco (volumes)
  echo ""
  warn "ATENÇÃO: Deseja apagar os dados do banco de dados (volumes Docker)?"
  warn "Isso removerá TODOS os dados de igrejas, membros e células."
  read -p "Apagar dados do banco? [s/N]: " WIPE_DATA
  if [[ "$WIPE_DATA" =~ ^[sS]$ ]]; then
    $DOCKER_CMD down --volumes 2>/dev/null || true
    ok "Volumes removidos — dados apagados"
  else
    ok "Dados do banco preservados"
  fi

  # Remove imagens locais antigas do projeto
  docker rmi crm_celular_backend crm_celular_frontend 2>/dev/null || true
  ok "Imagens Docker antigas removidas"

  # Remove arquivos de ambiente antigos
  rm -f .env server/.env
  ok "Arquivos .env removidos"

else
  # Modo Node/PM2: para o processo se estiver rodando
  if command -v pm2 &>/dev/null; then
    pm2 delete church-crm 2>/dev/null || true
    ok "Processo PM2 (church-crm) parado"
  fi

  # Remove dependências e build anteriores
  rm -rf node_modules dist
  rm -rf server/node_modules
  ok "node_modules e dist removidos"

  # Pergunta se deseja apagar o banco SQLite
  if [ -f "server/prisma/dev.db" ]; then
    echo ""
    warn "Banco de dados SQLite encontrado (server/prisma/dev.db)."
    read -p "Apagar dados do banco? [s/N]: " WIPE_DATA
    if [[ "$WIPE_DATA" =~ ^[sS]$ ]]; then
      rm -f server/prisma/dev.db
      ok "Banco de dados SQLite removido"
    else
      ok "Dados do banco preservados"
    fi
  fi

  # Remove arquivos de ambiente antigos
  rm -f server/.env .env
  ok "Arquivos .env removidos"
fi

# Restaura schema.prisma para o padrão (postgresql) em caso de instalação anterior com sqlite
if [ -f "server/prisma/schema.prisma" ]; then
  sed -i 's/provider = "sqlite"/provider = "postgresql"/g' server/prisma/schema.prisma 2>/dev/null || true
  ok "Schema Prisma restaurado para postgresql (padrão)"
fi

# ─── 3. Banco de Dados ─────────────────────────────────────
step "Banco de Dados"
echo "  1) PostgreSQL (padrão — recomendado para produção e múltiplas igrejas)"
echo "  2) SQLite (leve, arquivo local — uso legado ou desenvolvimento)"
echo ""
read -p "Escolha [1 ou 2, padrão: 1]: " DB_MODE
DB_MODE="${DB_MODE:-1}"

# ─── 4. Variáveis de Ambiente ──────────────────────────────
step "Configuração das Variáveis"
echo ""

# JWT Secret
read -p "JWT_SECRET (pressione Enter para gerar automaticamente): " JWT_USER
if [ -z "$JWT_USER" ]; then
  if [ "$HAS_OPENSSL" == "1" ]; then
    JWT_SECRET=$(openssl rand -hex 32)
  else
    JWT_SECRET=$(cat /dev/urandom | tr -dc 'a-f0-9' | fold -w 64 | head -n 1)
  fi
  ok "JWT_SECRET gerado: ${BOLD}${JWT_SECRET}${NC}"
else
  JWT_SECRET="$JWT_USER"
fi

# Domínio SaaS
echo ""
echo -e "${YELLOW}Domínio base SaaS${NC} — usado para distinguir subdomínios de igrejas"
echo -e "Exemplo: se igrejas acessam como ${BOLD}igreja1.saas.com.br${NC}, informe ${BOLD}saas.com.br${NC}"
echo -e "Em desenvolvimento local / sem domínio real: ${BOLD}deixe vazio${NC}"
read -p "SAAS_DOMAIN [vazio para pular]: " SAAS_DOMAIN_INPUT
SAAS_DOMAIN="${SAAS_DOMAIN_INPUT}"

# Matriz Organization
echo ""
divider
echo -e "${BOLD}${BLUE}   Configuração da Igreja Matriz (Sede Individual)   ${NC}"
divider
echo -e "${YELLOW}A Matriz é a sua igreja principal. Ela terá um subdomínio próprio (e.g. matriz.seu-dominio.com.br)${NC}"
read -p "Nome da Organização Matriz [Igreja Matriz]: " MTZ_NAME
MTZ_NAME="${MTZ_NAME:-Igreja Matriz}"
read -p "Nome da Congregação/Sede [Igreja Sede]: " MTZ_CONG
MTZ_CONG="${MTZ_CONG:-Igreja Sede}"
read -p "Nome do Administrador da Matriz [Admin Matriz]: " MTZ_ADM_NAME
MTZ_ADM_NAME="${MTZ_ADM_NAME:-Admin Matriz}"
read -p "Username do Admin Matriz [admin]: " MTZ_ADM_USER
MTZ_ADM_USER="${MTZ_ADM_USER:-admin}"
read -s -p "Senha do Admin Matriz [pressione Enter para gerar automaticamente]: " MTZ_ADM_PASS_INPUT
echo ""
if [ -z "$MTZ_ADM_PASS_INPUT" ]; then
  if [ "$HAS_OPENSSL" == "1" ]; then
    MTZ_ADM_PASS=$(openssl rand -base64 12 | tr -d '/+=' | head -c 12)
  else
    MTZ_ADM_PASS=$(cat /dev/urandom | tr -dc 'A-Za-z0-9' | fold -w 12 | head -n 1)
  fi
  ok "Senha do Admin Matriz gerada: ${BOLD}${YELLOW}${MTZ_ADM_PASS}${NC}"
else
  MTZ_ADM_PASS="$MTZ_ADM_PASS_INPUT"
fi

# Superadmin
echo ""
divider
echo -e "${BOLD}${BLUE}   Configuração do Super Administrador (Dono do SaaS)   ${NC}"
divider
echo -e "${YELLOW}O Superadmin gerencia a plataforma, cria novas igrejas e define planos.${NC}"
read -p "Username do superadmin [superadmin]: " SA_USERNAME
SA_USERNAME="${SA_USERNAME:-superadmin}"
read -s -p "Senha do superadmin [pressione Enter para gerar automaticamente]: " SA_PASSWORD_INPUT
echo ""
if [ -z "$SA_PASSWORD_INPUT" ]; then
  if [ "$HAS_OPENSSL" == "1" ]; then
    SA_PASSWORD=$(openssl rand -base64 12 | tr -d '/+=' | head -c 12)
  else
    SA_PASSWORD=$(cat /dev/urandom | tr -dc 'A-Za-z0-9' | fold -w 12 | head -n 1)
  fi
  ok "Senha do Superadmin gerada: ${BOLD}${RED}${SA_PASSWORD}${NC}"
else
  SA_PASSWORD="$SA_PASSWORD_INPUT"
fi

# URL do Banco
if [ "$DB_MODE" == "1" ]; then
  if [ "$RUN_MODE" == "1" ]; then
    echo ""
    read -p "URL do PostgreSQL (ex: postgresql://user:pass@localhost:5432/church_crm?schema=public): " PG_URL
    DB_URL="$PG_URL"
  else
    echo ""
    read -p "Senha do PostgreSQL no Docker [crm_password]: " PG_PASS
    PG_PASS="${PG_PASS:-crm_password}"
    DB_URL="postgresql://crm:${PG_PASS}@postgres:5432/church_crm?schema=public"
  fi
else
  DB_URL="file:./dev.db"
fi

# ─── 5. Porta ──────────────────────────────────────────────
if [ "$RUN_MODE" == "1" ]; then
  echo ""
  read -p "Porta HTTP do servidor backend [3000]: " APP_PORT
  APP_PORT="${APP_PORT:-3000}"
else
  APP_PORT=3000
fi

# ─── 6. Criar .env ─────────────────────────────────────────
step "Criando arquivos .env..."

cat > server/.env <<EOT
NODE_ENV=production
PORT=${APP_PORT}
JWT_SECRET=${JWT_SECRET}
DATABASE_URL="${DB_URL}"
SAAS_DOMAIN=${SAAS_DOMAIN}
SUPERADMIN_USERNAME=${SA_USERNAME}
SUPERADMIN_PASSWORD=${SA_PASSWORD}
MATRIZ_NAME="${MTZ_NAME}"
MATRIZ_CONGREGATION="${MTZ_CONG}"
MATRIZ_ADMIN_NAME="${MTZ_ADM_NAME}"
MATRIZ_ADMIN_USERNAME="${MTZ_ADM_USER}"
MATRIZ_ADMIN_PASSWORD="${MTZ_ADM_PASS}"
EOT
ok "server/.env criado"

# .env raiz apenas para Docker Compose
if [ "$RUN_MODE" == "2" ]; then
cat > .env <<EOT
NODE_ENV=production
PORT=${APP_PORT}
JWT_SECRET=${JWT_SECRET}
DATABASE_URL="${DB_URL}"
SAAS_DOMAIN=${SAAS_DOMAIN}
SUPERADMIN_USERNAME=${SA_USERNAME}
SUPERADMIN_PASSWORD=${SA_PASSWORD}
MATRIZ_NAME="${MTZ_NAME}"
MATRIZ_CONGREGATION="${MTZ_CONG}"
MATRIZ_ADMIN_NAME="${MTZ_ADM_NAME}"
MATRIZ_ADMIN_USERNAME="${MTZ_ADM_USER}"
MATRIZ_ADMIN_PASSWORD="${MTZ_ADM_PASS}"
POSTGRES_USER=crm
POSTGRES_PASSWORD=${PG_PASS:-crm_password}
POSTGRES_DB=church_crm
EOT
ok ".env raiz criado (para Docker Compose)"
fi

# ─── 7. Prisma Schema ──────────────────────────────────────
step "Configurando Prisma ORM..."
SCHEMA_FILE="server/prisma/schema.prisma"
if [ "$DB_MODE" == "2" ]; then
  # SQLite: troca o provider para sqlite usando sed
  sed -i 's/provider = "postgresql"/provider = "sqlite"/g' "$SCHEMA_FILE" 2>/dev/null || true
  ok "Prisma configurado para SQLite"
else
  # PostgreSQL: já é o padrão no schema (ou foi restaurado no início)
  ok "Prisma configurado para PostgreSQL (padrão)"
fi

# ─── 8. Instalação ─────────────────────────────────────────
if [ "$RUN_MODE" == "1" ]; then
  divider
  echo -e "${BOLD}${BLUE}   Instalando dependências (Modo Local)   ${NC}"
  divider

  step "Instalando frontend..."
  npm install --no-audit --no-fund --silent
  ok "Frontend instalado"

  step "Build da interface web (Vite)..."
  npm run build
  ok "Build concluído → ./dist"

  step "Instalando backend..."
  cd server
  npm install --no-audit --no-fund --silent
  ok "Backend instalado"

  step "Gerando Prisma client e criando tabelas..."
  npx prisma generate --silent
  npx prisma db push --skip-generate --accept-data-loss
  ok "Banco de dados pronto"
  cd ..

  # PM2
  if [ "$HAS_PM2" == "1" ]; then
    echo ""
    read -p "Deseja iniciar o servidor agora com PM2 (gerenciador de processos)? [s/N]: " USE_PM2
    if [[ "$USE_PM2" =~ ^[sS]$ ]]; then
      cd server
      pm2 delete church-crm 2>/dev/null || true
      pm2 start index.js --name church-crm --restart-delay=3000
      pm2 save
      ok "Servidor rodando via PM2 (nome: church-crm)"
      cd ..
      echo -e "${YELLOW}Para iniciar PM2 no boot do sistema: ${BOLD}pm2 startup${NC}"
    fi
  else
    warn "PM2 não encontrado. Para gerenciar o processo como serviço, instale: npm install -g pm2"
  fi

elif [ "$RUN_MODE" == "2" ]; then
  divider
  echo -e "${BOLD}${BLUE}   Iniciando via Docker Compose   ${NC}"
  divider

  step "Build e inicialização dos containers..."
  $DOCKER_CMD up -d --build
  ok "Containers iniciados"

  # Aguarda o backend respirar
  step "Aguardando backend ficar pronto..."
  TRIES=0
  # Substituímos o curl (que não existe no container slim) por um pequeno script node
  until docker exec crm_celular_backend node -e "require('http').get('http://localhost:3000/api/public/org/saas-admin', r => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))" &>/dev/null || [ $TRIES -gt 20 ]; do
    sleep 3
    TRIES=$((TRIES+1))
    echo -n "."
  done
  echo ""

  step "Aplicando schema do banco de dados..."
  docker exec crm_celular_backend npx prisma generate --silent 2>/dev/null || true
  docker exec crm_celular_backend npx prisma db push --accept-data-loss 2>/dev/null || true
  ok "Banco de dados pronto"
fi

# ─── 9. Resumo Final ───────────────────────────────────────
echo ""
divider
echo -e "${BOLD}${GREEN}   ✓ INSTALAÇÃO CONCLUÍDA COM SUCESSO!   ${NC}"
divider
echo ""
echo -e "${BOLD}Credenciais do Super Administrador:${NC}"
echo -e "  Usuário : ${BOLD}${GREEN}${SA_USERNAME}${NC}"
echo -e "  Senha   : ${BOLD}${RED}${SA_PASSWORD}${NC}"
echo ""
if [ "$RUN_MODE" == "1" ]; then
  echo -e "${BOLD}Como iniciar o servidor:${NC}"
  if [ "$HAS_PM2" == "1" ]; then
    echo -e "  ${YELLOW}pm2 start church-crm${NC}  (PM2)"
  fi
  echo -e "  ${YELLOW}cd server && node index.js${NC}  (manual)"
  echo ""
  echo -e "${BOLD}URL de acesso:${NC}"
  echo -e "  ${BLUE}http://localhost:${APP_PORT}${NC}"
  if [ -n "$SAAS_DOMAIN" ]; then
    echo -e "  ${BLUE}http://*.${SAAS_DOMAIN}${NC}  (via Nginx/proxy reverso)"
  fi
else
  echo -e "${BOLD}Containers rodando:${NC}"
  echo -e "  ${YELLOW}docker ps${NC}  — para ver status"
  echo ""
  echo -e "${BOLD}URL de acesso:${NC}"
  echo -e "  ${BLUE}http://localhost${NC}  (porta 80)"
  if [ -n "$SAAS_DOMAIN" ]; then
    echo -e "  ${BLUE}http://*.${SAAS_DOMAIN}${NC}  (via wildcard DNS)"
  fi
fi
echo ""
echo -e "${YELLOW}⚠  Altere a senha do superadmin imediatamente após o primeiro login!${NC}"
echo -e "${YELLOW}⚠  Guarde as credenciais acima em local seguro.${NC}"
echo ""
if [ -n "$SAAS_DOMAIN" ]; then
  echo -e "${BOLD}Para HTTPS (Let's Encrypt):${NC}"
  echo -e "  certbot certonly --manual --preferred-challenges dns \\"
  echo -e "    -d ${SAAS_DOMAIN} -d *.${SAAS_DOMAIN}"
  echo -e "  Depois, siga as instruções no ${BOLD}nginx.conf${NC} para ativar o bloco HTTPS."
  echo ""
fi
divider
echo ""
