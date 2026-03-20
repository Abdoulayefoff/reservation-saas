# Dockerfile – Auth Service (Symfony 7 / PHP 8.3)
# Multi-stage build : on sépare la compilation du runtime
# pour obtenir une image finale légère et sécurisée

# STAGE 1 : builder
# Installe les dépendances et compile le projet
FROM php:8.3-cli AS builder

# Installation des extensions PHP nécessaires
# pdo_pgsql : connexion PostgreSQL
# intl      : internationalisation (requis par Symfony)
# zip       : gestion des archives (requis par Composer)
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

# Copier Composer depuis son image officielle
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Copier les manifestes en premier pour bénéficier du cache Docker
# Si composer.json ne change pas, cette couche est réutilisée
COPY composer.json composer.lock ./

# Installer les dépendances sans les scripts (projet pas encore copié)
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist

# Copier tout le code source
COPY . .

# Générer l'autoloader optimisé pour la production
RUN composer dump-autoload --optimize --no-dev

# STAGE 2 : runtime
# Image finale légère avec uniquement ce qui est nécessaire
FROM php:8.3-fpm-alpine AS runtime

# Installation des libs runtime uniquement (pas les headers de compilation)
RUN apk add --no-cache \
        libpq \
        icu-libs \
        libzip \
        wget \
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

WORKDIR /app

# Copier uniquement le résultat du builder (pas les outils de build)
COPY --from=builder /app .

# Créer les dossiers Symfony avec les bonnes permissions
RUN mkdir -p var/cache var/log \
    && chmod -R 777 var/

# Exposer le port interne du service
EXPOSE 8001

# Healthcheck – vérifie que le service répond
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
    CMD wget -qO- http://localhost:8001/health || exit 1

# Copier et activer le script de démarrage
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]