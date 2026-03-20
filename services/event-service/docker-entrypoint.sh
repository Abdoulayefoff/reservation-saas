#!/bin/sh
# docker-entrypoint.sh – Event Service
set -e

# Application des migrations Doctrine
echo "🗄️  Application des migrations..."
php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration

# Démarrage du serveur PHP sur le port 8003
echo "🚀 Démarrage du Event Service sur le port 8003..."
exec php -S 0.0.0.0:8003 -t public/