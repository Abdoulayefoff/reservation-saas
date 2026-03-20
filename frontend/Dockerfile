# Dockerfile – Frontend (React 18 / TypeScript / Vite)
# Multi-stage build : builder pour la compilation React,
# runtime Nginx pour servir les fichiers statiques.
#
# IMPORTANT : Ce Dockerfile ne fait PAS npm install.
# L'installation des dépendances est gérée par le script setup.sh
# via : docker compose exec frontend npm install && npm run build

# ─────────────────────────────────────────────────────────────
# STAGE 1 : builder
# Copie le code source pour le runtime
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Installation des outils nécessaires au build
RUN apk add --no-cache bash

WORKDIR /app

# Copier tout le code source
COPY . .

# ─────────────────────────────────────────────────────────────
# STAGE 2 : runtime
# Nginx Alpine pour servir les fichiers statiques React
# Le build React (dist/) sera généré par setup.sh
# ─────────────────────────────────────────────────────────────
FROM nginx:alpine AS runtime

# Installation des outils nécessaires au runtime
# wget : utilisé par le healthcheck Docker
# bash : utilisé par les scripts
RUN apk add --no-cache wget bash

# Copier la configuration Nginx personnalisée
# Cette config gère le SPA routing (toutes les routes → index.html)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copier le code source depuis le builder
# Le dossier dist/ sera vide au départ et peuplé par setup.sh
COPY --from=builder /app /app

# Créer le dossier de build React
# Il sera peuplé par setup.sh via npm run build
RUN mkdir -p /usr/share/nginx/html

# Exposer le port interne du Frontend
EXPOSE 3000

# Healthcheck – Docker vérifie que Nginx répond toutes les 10s
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- http://localhost:3000 || exit 1

# Nginx démarre automatiquement en foreground
CMD ["nginx", "-g", "daemon off;"]