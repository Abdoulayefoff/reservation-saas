# Dockerfile – Frontend (React 18 / TypeScript / Vite)
# Multi-stage build :
#   Stage 1 (builder) : installe les dépendances et build React
#   Stage 2 (runtime) : Nginx Alpine sert les fichiers statiques
#
# Quelqu'un qui clone le repo peut lancer `docker compose up --build`
# sans avoir Node.js ou npm installés sur sa machine.

# STAGE 1 : builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copier les fichiers de dépendances EN PREMIER (cache Docker optimisé)
# Si package.json ne change pas, npm install ne relance pas au rebuild
COPY package*.json ./

# Installer toutes les dépendances (dev incluses pour le build Vite)
RUN npm install

# Copier tout le code source
COPY . .

# Build de production React/Vite → génère /app/dist/
RUN npm run build

# STAGE 2 : runtime
FROM nginx:alpine AS runtime

# Outils nécessaires au healthcheck et aux scripts
RUN apk add --no-cache wget bash

# Configuration Nginx personnalisée (SPA routing : toutes les routes → index.html)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copier les fichiers buildés par Vite vers le dossier servi par Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Exposer le port interne du Frontend
EXPOSE 3000

# Healthcheck – Docker vérifie que Nginx répond toutes les 10s
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- http://localhost:3000 || exit 1

CMD ["nginx", "-g", "daemon off;"]
