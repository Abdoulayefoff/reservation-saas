# Dockerfile – Auth Service (Symfony 7 / PHP 8.3)
# Multi-stage build : builder pour les extensions PHP,
# runtime pour l'image finale légère.
#
# IMPORTANT : Ce Dockerfile ne fait PAS composer install.
# L'installation des dépendances est gérée par le script setup.sh
# via : docker compose exec auth-service composer install
# Cela permet à n'importe qui de cloner le repo et lancer ./setup.sh
# sans avoir PHP ou Composer installés sur sa machine.

# STAGE 1 : builder
# Compile les extensions PHP natives nécessaires
FROM php:8.3-cli AS builder

# Installation des headers de compilation et des extensions PHP
# libpq-dev  : headers PostgreSQL pour compiler pdo_pgsql
# libicu-dev : headers ICU pour compiler intl (requis par Symfony)
# libzip-dev : headers zip pour compiler l'extension zip
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq-dev \
        libicu-dev \
        libzip-dev \
        unzip \
        git \
    && docker-php-ext-install \
        pdo \
        pdo_pgsql \
        intl \
        zip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# STAGE 2 : runtime
# Image finale légère – uniquement les libs runtime
FROM php:8.3-fpm-alpine AS runtime

# Installation des librairies runtime (sans headers de compilation)
# .build-deps : groupe temporaire supprimé après installation des extensions
RUN apk add --no-cache \
        libpq \
        icu-libs \
        libzip \
        wget \
        bash \
    && apk add --no-cache --virtual .build-deps \
        libpq-dev \
        icu-dev \
        libzip-dev \
    && docker-php-ext-install \
        pdo \
        pdo_pgsql \
        intl \
        zip \
    && apk del .build-deps

# Copier Composer depuis son image officielle
# Composer sera utilisé par setup.sh pour installer les dépendances
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Copier tout le code source du service
# vendor/ est dans .gitignore et sera créé par setup.sh
COPY . .

# Créer les dossiers nécessaires à Symfony avec les bonnes permissions
# var/cache : cache du container DI, routes, etc.
# var/log   : logs applicatifs Symfony
# config/jwt : dossier pour les clés JWT (générées par setup.sh)
RUN mkdir -p var/cache var/log config/jwt \
    && chmod -R 777 var/ \
    && chmod -R 700 config/jwt

# Exposer le port interne du Auth Service
EXPOSE 8001

# Healthcheck – Docker vérifie que le service répond toutes les 15s
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
    CMD wget -qO- http://localhost:8001/health || exit 1

# Copier et activer le script de démarrage
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]