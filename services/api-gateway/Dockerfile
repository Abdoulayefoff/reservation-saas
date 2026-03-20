# Dockerfile – API Gateway (Node.js 20 / TypeScript)
# Multi-stage build : builder pour la compilation TypeScript,
# runtime pour l'image finale légère.
#
# IMPORTANT : Ce Dockerfile ne fait PAS npm install.
# L'installation des dépendances est gérée par le script setup.sh
# via : docker compose exec api-gateway npm install

# ─────────────────────────────────────────────────────────────
# STAGE 1 : builder
# Copie le code source pour le runtime
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copier tout le code source
COPY . .

# ─────────────────────────────────────────────────────────────
# STAGE 2 : runtime
# Image finale légère – Node.js Alpine
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

# Installation des outils nécessaires au runtime
# wget : utilisé par le healthcheck Docker
# bash : utilisé par le docker-entrypoint.sh
RUN apk add --no-cache wget bash

WORKDIR /app

# Copier le code source depuis le builder
COPY --from=builder /app .

# Créer le dossier dist pour la compilation TypeScript
# Il sera peuplé par setup.sh via npm run build
RUN mkdir -p dist

# Exposer le port interne de l'API Gateway
EXPOSE 8000

# Healthcheck – Docker vérifie que le service répond toutes les 15s
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
    CMD wget -qO- http://localhost:8000/health || exit 1

# Copier et activer le script de démarrage
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]