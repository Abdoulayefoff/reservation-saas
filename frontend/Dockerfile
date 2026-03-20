# Dockerfile – Frontend (React 18 + TypeScript / Vite)
# Multi-stage build : builder → runtime nginx

# STAGE 1 : builder
# Compile le projet React avec Vite
FROM node:20-alpine AS builder

WORKDIR /app

# Copier les manifestes en premier pour le cache Docker
COPY package.json package-lock.json ./

# Installer toutes les dépendances
RUN npm ci --frozen-lockfile

# Copier tout le code source
COPY . .

# Compiler le projet React pour la production
# Vite génère les fichiers optimisés dans dist/
RUN npm run build

# STAGE 2 : runtime
# Nginx sert les fichiers statiques compilés
FROM nginx:alpine AS runtime

# Supprimer la configuration Nginx par défaut
RUN rm /etc/nginx/conf.d/default.conf

# Copier notre configuration SPA personnalisée
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copier les fichiers compilés par Vite
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3000 || exit 1

CMD ["nginx", "-g", "daemon off;"]