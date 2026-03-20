#!/bin/sh
# docker-entrypoint.sh – Auth Service
# Exécuté automatiquement au démarrage du container
# set -e : arrête le script à la première erreur
set -e

# Génération des clés JWT (privée + publique)
# --overwrite : régénère si elles existent déjà
# Nécessaire car les clés ne sont pas commitées sur Git
echo "🔑 Génération des clés JWT..."
php bin/console lexik:jwt:generate-keypair --overwrite --no-interaction

# Application des migrations Doctrine
# --allow-no-migration : pas d'erreur si aucune migration en attente
echo "🗄️  Application des migrations..."
php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration

# Démarrage du serveur PHP intégré
# 0.0.0.0 : écoute sur toutes les interfaces réseau du container
# -t public/ : le dossier public/ est la racine web de Symfony
echo "🚀 Démarrage du Auth Service sur le port 8001..."
exec php -S 0.0.0.0:8001 -t public/