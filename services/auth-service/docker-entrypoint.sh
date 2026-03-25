#!/bin/bash
# docker-entrypoint.sh – Auth Service
# Exécuté automatiquement au démarrage du container
# set -e : arrête le script à la première erreur
set -e

# Symfony Dotenv exige qu'un fichier .env existe dans le répertoire de travail.
# Sur un nouveau clone, le fichier peut être absent si ignoré par Git.
# On le crée vide s'il n'existe pas pour éviter un crash au démarrage.
[ ! -f ".env" ] && touch .env

# Installation automatique des dépendances si vendor/ est absent
# Cela permet de lancer le projet avec un simple docker compose up
# sans avoir besoin de PHP ou Composer sur la machine hôte
if [ ! -f "vendor/autoload.php" ]; then
    echo "Installation des dépendances Composer..."
    composer install --no-interaction --optimize-autoloader
    echo "Dépendances installées"
fi

# Génération automatique des clés JWT si absentes
# Les clés sont nécessaires pour signer/vérifier les tokens
if [ ! -f "config/jwt/private.pem" ]; then
    echo "Génération des clés JWT..."
    php bin/console lexik:jwt:generate-keypair --no-interaction 2>/dev/null || true
    echo "Clés JWT générées"
fi

# Attente que la base de données soit prête
# La DB met parfois quelques secondes à accepter les connexions
# même après que le healthcheck Docker soit passé
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
# --allow-no-migration : pas d'erreur si rien à migrer
echo "Application des migrations Doctrine..."
php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration
echo "Migrations appliquées"

# Nettoyage et warm-up du cache Symfony
# Utilise APP_ENV pour adapter le cache (dev/prod)
echo "Warm-up du cache Symfony..."
php bin/console cache:clear --no-interaction 2>/dev/null || true
php bin/console cache:warmup --no-interaction
echo "Cache prêt"

# Démarrage du serveur PHP intégré
# 0.0.0.0 : écoute sur toutes les interfaces du container
# -t public/ : racine web Symfony
echo "Démarrage du Auth Service sur le port 8001..."
exec php -S 0.0.0.0:8001 -t public/