# Dockerfile – Notification Service (Node.js 20 / TypeScript)
# Pas de BDD – uniquement consumer RabbitMQ
# Multi-stage build : builder → runtime

# STAGE 1 : builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copier les manifestes en premier pour le cache Docker
COPY package.json package-lock.json ./

# Installer toutes les dépendances (dev inclus pour compiler TS)
RUN npm ci --frozen-lockfile

# Copier la config TypeScript et les sources
COPY tsconfig.json ./
COPY src/ ./src/

# Compiler TypeScript → JavaScript dans dist/
RUN npm run build

# STAGE 2 : runtime
FROM node:20-alpine AS runtime

# wget nécessaire pour le healthcheck
RUN apk add --no-cache wget

WORKDIR /app

# Installer uniquement les dépendances de production
COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile --omit=dev

# Copier le code compilé depuis le builder
COPY --from=builder /app/dist ./dist

# Utilisateur non-root pour la sécurité
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 8005

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
    CMD wget -qO- http://localhost:8005/health || exit 1

COPY --chown=appuser:appgroup docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]