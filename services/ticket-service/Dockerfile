# Dockerfile – Ticket Service (Node.js 20 / Express / TypeScript)
# Multi-stage build : builder → runtime

# STAGE 1 : builder
# Compile le TypeScript et génère le client Prisma
FROM node:20-alpine AS builder

WORKDIR /app

# Copier les manifestes en premier pour le cache Docker
# Si package.json ne change pas, npm ci est mis en cache
COPY package.json package-lock.json ./

# Installer TOUTES les dépendances (dev inclus pour compiler TS)
RUN npm ci --frozen-lockfile

# Copier la config TypeScript et les sources
COPY tsconfig.json ./
COPY src/ ./src/
COPY prisma/ ./prisma/

# Compiler TypeScript → JavaScript dans dist/
RUN npm run build

# Générer le client Prisma pour la BDD
RUN npx prisma generate

# STAGE 2 : runtime
# Image finale avec uniquement les dépendances de production
FROM node:20-alpine AS runtime

# wget nécessaire pour le healthcheck
RUN apk add --no-cache wget

WORKDIR /app

# Installer uniquement les dépendances de production
COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile --omit=dev

# Copier le code compilé depuis le builder
COPY --from=builder /app/dist ./dist

# Copier le client Prisma généré (nécessaire au runtime)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copier le schéma Prisma (nécessaire pour les migrations)
COPY prisma/ ./prisma/

# Utilisateur non-root pour la sécurité (principe du moindre privilège)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 8004

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
    CMD wget -qO- http://localhost:8004/health || exit 1

COPY --chown=appuser:appgroup docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]