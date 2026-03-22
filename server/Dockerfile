# server/Dockerfile
# Usando a base Debian (glibc) que é recomendada nativamente pelo Prisma 
# para resolver o erro "libssl.so.1.1: No such file or directory" no Linux Alpine
FROM node:20-bullseye-slim

WORKDIR /app

# Instala dependências de produção
COPY --chown=node:node package*.json ./
RUN npm ci --only=production

# Instalação das dependências do sistema para o Chromium / Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Copia o restante do projeto do backend
COPY --chown=node:node . .

# Gera o Prisma Client inicial
RUN npx prisma generate

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

USER node

# Inicializa o banco (cria tabelas se não existirem) e inicia o servidor
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node index.js"]
