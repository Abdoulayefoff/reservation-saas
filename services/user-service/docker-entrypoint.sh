#!/bin/bash
# docker-entrypoint.sh – User Service
# Exécuté automatiquement au démarrage du container
# set -e : arrête le script à la première erreur
set -e

# ─────────────────────────────────────────────────────────────
# Vérification que les dépendances sont installées
# Si vendor/ n'existe pas, le service ne peut pas démarrer
# ─────────────────────────────────────────────────────────────
if [ ! -d "vendor" ]; then
    echo "❌ Le dossier vendor/ est absent."
    echo "👉 Lancez d'abord : ./setup.sh"
    exit 1
fi

# ─────────────────────────────────────────────────────────────
# Application des migrations Doctrine
# ─────────────────────────────────────────────────────────────
echo "🗄️  Application des migrations Doctrine..."
php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration

# ─────────────────────────────────────────────────────────────
# Nettoyage et warm-up du cache Symfony
# ─────────────────────────────────────────────────────────────
echo "🔥 Warm-up du cache Symfony..."
php bin/console cache:warmup --env=prod

# ─────────────────────────────────────────────────────────────
# Démarrage du serveur PHP intégré
# 0.0.0.0 : écoute sur toutes les interfaces du container
# -t public/ : racine web Symfony
# ─────────────────────────────────────────────────────────────
echo "🚀 Démarrage du User Service sur le port 8002..."
exec php -S 0.0.0.0:8002 -t public/