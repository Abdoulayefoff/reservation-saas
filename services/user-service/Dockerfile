# ============================================================
# Dockerfile – User Service (Symfony 7 / PHP 8.3)
# Multi-stage build : builder → runtime
# ============================================================

# ------------------------------------------------------------
# STAGE 1 : builder
# ------------------------------------------------------------
FROM php:8.3-cli AS builder

# Installation des extensions PHP nécessaires
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

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Copier les manifestes en premier pour le cache Docker
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist

COPY . .
RUN composer dump-autoload --optimize --no-dev

# ------------------------------------------------------------
# STAGE 2 : runtime
# ------------------------------------------------------------
FROM php:8.3-fpm-alpine AS runtime

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
COPY --from=builder /app .

RUN mkdir -p var/cache var/log \
    && chmod -R 777 var/

EXPOSE 8002

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
    CMD wget -qO- http://localhost:8002/health || exit 1

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]