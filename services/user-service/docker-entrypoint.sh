#!/bin/bash
# docker-entrypoint.sh – User Service
# Exécuté automatiquement au démarrage du container
# set -e : arrête le script à la première erreur
set -e

# Symfony Dotenv exige qu'un fichier .env existe dans le répertoire de travail.
# Sur un nouveau clone, le fichier peut être absent si ignoré par Git.
[ ! -f ".env" ] && touch .env

# Installation automatique des dépendances si vendor/ est absent
# Cela permet de lancer le projet avec un simple docker compose up
if [ ! -f "vendor/autoload.php" ]; then
    echo "Installation des dépendances Composer..."
    composer install --no-interaction --optimize-autoloader
    echo "Dépendances installées"
fi

# Attente que la base de données soit prête
echo "Attente de la base de données..."
MAX_RETRIES=30
RETRY_COUNT=0
until php bin/console doctrine:database:create --if-not-exists --no-interaction 2>/dev/null; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "La base de données n'est pas accessible après ${MAX_RETRIES} tentatives"
        exit 1
    fi
    echo "  Tentative $RETRY_COUNT/$MAX_RETRIES..."
    sleep 2
done
echo "Base de données prête"

# Application des migrations Doctrine
echo "Application des migrations Doctrine..."
php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration
echo "Migrations appliquées"

# Nettoyage et warm-up du cache Symfony
echo "Warm-up du cache Symfony..."
php bin/console cache:clear --no-interaction 2>/dev/null || true
php bin/console cache:warmup --no-interaction
echo "Cache prêt"

# Démarrage du serveur PHP intégré
# 0.0.0.0 : écoute sur toutes les interfaces du container
# -t public/ : racine web Symfony
echo "Démarrage du User Service sur le port 8002..."
exec php -S 0.0.0.0:8002 -t public/