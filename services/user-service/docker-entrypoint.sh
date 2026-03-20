#!/bin/sh
# docker-entrypoint.sh – User Service
# Pas de génération JWT ici, uniquement migrations + démarrage
set -e

# Application des migrations Doctrine
echo "🗄️  Application des migrations..."
php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration

# Démarrage du serveur PHP sur le port 8002
echo "🚀 Démarrage du User Service sur le port 8002..."
exec php -S 0.0.0.0:8002 -t public/