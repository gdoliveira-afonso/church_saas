# Guia de Deploy

## Visão Geral

A stack em produção é composta por três containers:

| Container             | Imagem              | Função                                        |
|-----------------------|---------------------|-----------------------------------------------|
| `crm_postgres`        | postgres:16         | Banco de dados                                |
| `crm_celular_backend` | build ./server      | API Express (porta interna 3000)              |
| `crm_celular_frontend`| build .             | Nginx servindo o SPA + proxy reverso para API |

O frontend expõe as portas `80` e `443`. O backend e o banco ficam em rede interna — sem exposição de portas ao host.

---

## Pré-requisitos

- VPS com Docker e Docker Compose instalados
- Domínio apontando para o IP da VPS (wildcard `*.seudominio.com.br` para multitenancy)
- `openssl` disponível (para gerar JWT_SECRET)

---

## Deploy Inicial

### 1. Clone o repositório

```bash
git clone <url-do-repositorio>
cd <pasta-do-projeto>
```

### 2. Configure o ambiente

```bash
cp .env.example .env
```

Edite o `.env` com os valores de produção:

```env
JWT_SECRET=<gerado com: openssl rand -hex 32>
SUPERADMIN_PASSWORD=<senha forte>
DATABASE_URL=postgresql://crm:crm_password@postgres:5432/church_crm
POSTGRES_USER=crm
POSTGRES_PASSWORD=crm_password
POSTGRES_DB=church_crm
SAAS_DOMAIN=seudominio.com.br
ALLOWED_ORIGINS=https://seudominio.com.br,https://matriz.seudominio.com.br
```

> O servidor recusará iniciar se `JWT_SECRET` ou `SUPERADMIN_PASSWORD` não estiverem definidos.

### 3. Suba os containers

```bash
docker-compose up -d
```

O Docker Compose aguarda o healthcheck do postgres antes de subir o backend, e o healthcheck do backend antes de subir o frontend. Na primeira execução, o servidor aplica o schema no banco automaticamente via `prisma db push`.

### 4. Verifique os logs

```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

---

## Variáveis de Ambiente Obrigatórias

| Variável              | Descrição                                                              |
|-----------------------|------------------------------------------------------------------------|
| `JWT_SECRET`          | Chave secreta JWT. Gerada com `openssl rand -hex 32`. Nunca reutilizar entre ambientes. |
| `SUPERADMIN_PASSWORD` | Senha do superadmin. Sem fallback hardcoded — ausência impede o seed.  |
| `DATABASE_URL`        | Connection string PostgreSQL completa                                  |

---

## Migração de Banco

O projeto usa `prisma db push` para sincronizar o schema em produção (não usa `migrate deploy` com arquivos de migração formatados para SQLite).

### Aplicar mudanças de schema em produção

```bash
# Acesse o container do backend
docker exec -it crm_celular_backend sh

# Aplique o schema
npx prisma db push
```

Ou em um container temporário:

```bash
docker run --rm \
  --network <rede_do_compose> \
  -e DATABASE_URL="postgresql://..." \
  -v $(pwd)/server/prisma:/app/prisma \
  node:20-alpine \
  sh -c "npm i prisma && npx prisma db push --schema=/app/prisma/schema.prisma"
```

### Trocar de SQLite para PostgreSQL (dev → prod)

1. Edite `server/prisma/schema.prisma`:

```diff
 datasource db {
-  provider = "sqlite"
+  provider = "postgresql"
   url      = env("DATABASE_URL")
 }
```

2. Atualize `DATABASE_URL` no `.env`
3. Rode `npx prisma generate` (com o servidor parado no Windows)
4. Execute `npx prisma db push`

---

## HTTPS com Let's Encrypt

### 1. Gere o certificado wildcard

```bash
certbot certonly --manual --preferred-challenges dns \
  -d seudominio.com.br -d *.seudominio.com.br
```

Adicione o registro TXT no DNS quando solicitado.

### 2. Copie os certificados para o volume SSL

```bash
# O volume crm_ssl_data é montado em /etc/nginx/ssl no container frontend
docker cp /etc/letsencrypt/live/seudominio.com.br/fullchain.pem \
  crm_celular_frontend:/etc/nginx/ssl/fullchain.pem

docker cp /etc/letsencrypt/live/seudominio.com.br/privkey.pem \
  crm_celular_frontend:/etc/nginx/ssl/privkey.pem
```

### 3. Ative o bloco HTTPS no nginx.conf

Descomente o bloco `server { listen 443 ssl http2; ... }` no `nginx.conf` e ative o redirect HTTP → HTTPS:

```nginx
# No bloco listen 80, substitua o conteúdo por:
return 301 https://$host$request_uri;
```

### 4. Reinicie o frontend

```bash
docker-compose restart frontend
```

> Ative o HSTS (`Strict-Transport-Security`) somente após confirmar que o HTTPS está funcionando corretamente.

---

## Nginx — Configuração Resumida

O `nginx.conf` faz:

- **SPA routing**: qualquer rota não encontrada cai em `index.html` (hash-based router)
- **Proxy da API**: `/api/` → `http://backend:3000/api/` com headers `Host`, `X-Real-IP`, `X-Forwarded-*`
- **Proxy de uploads**: `/uploads/` → `http://backend:3000/uploads/`
- **Cache de assets**: CSS/JS/imagens com `max-age=31536000, immutable`
- **Gzip**: ativado para texto, JSON, SVG
- **Security headers**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`

---

## Volumes Persistentes

| Volume             | Conteúdo                                      | Impacto se perdido          |
|--------------------|-----------------------------------------------|-----------------------------|
| `crm_pg_data`      | Dados do PostgreSQL                           | Perda total dos dados        |
| `crm_uploads_data` | Logos e imagens enviadas pelas organizações   | Perda de imagens/logos       |
| `crm_ssl_data`     | Certificados SSL (fullchain.pem + privkey.pem)| HTTPS para de funcionar      |

> Faça backup periódico do volume `crm_pg_data`.

### Backup manual do banco

```bash
docker exec crm_postgres pg_dump -U crm church_crm > backup_$(date +%Y%m%d).sql
```

---

## Atualizações

```bash
git pull
docker-compose build --no-cache
docker-compose up -d
```

Se houve mudanças no schema Prisma:

```bash
docker exec -it crm_celular_backend npx prisma db push
```

---

## Multitenancy

Cada organização acessa o sistema via:
- **Subdomínio**: `slug.seudominio.com.br` — requer wildcard DNS e `SAAS_DOMAIN` configurado
- **Domínio customizado**: configurado no campo `Organization.customDomain`

O backend resolve a organização pelo header `Host` da requisição.

---

## Segurança em Produção

- `JWT_SECRET` único por instância, nunca compartilhado entre ambientes
- `SUPERADMIN_PASSWORD` forte e armazenada apenas no `.env` (não versionada)
- Porta `5432` do PostgreSQL não exposta ao host (apenas via rede interna Docker)
- Porta `3000` do backend não exposta ao host (acesso apenas via Nginx)
- CORS restrito via `ALLOWED_ORIGINS`
- Rate limiting: 5 tentativas de login por IP/15min; 200 req/IP/min geral
- Helmet ativado (headers de segurança HTTP)
