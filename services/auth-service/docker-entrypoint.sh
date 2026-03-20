#!/bin/bash
# docker-entrypoint.sh – Auth Service
# Exécuté automatiquement au démarrage du container
# set -e : arrête le script à la première erreur
set -e

# ─────────────────────────────────────────────────────────────
# Vérification que les dépendances sont installées
# Si vendor/ n'existe pas, le service ne peut pas démarrer
# Les dépendances doivent être installées via setup.sh
# ─────────────────────────────────────────────────────────────
if [ ! -d "vendor" ]; then
    echo "❌ Le dossier vendor/ est absent."
    echo "👉 Lancez d'abord : ./setup.sh"
    exit 1
fi

# ─────────────────────────────────────────────────────────────
# Vérification que les clés JWT existent
# Générées par setup.sh via lexik:jwt:generate-keypair
# ─────────────────────────────────────────────────────────────
if [ ! -f "config/jwt/private.pem" ]; then
    echo "❌ Les clés JWT sont absentes."
    echo "👉 Lancez d'abord : ./setup.sh"
    exit 1
fi

# ─────────────────────────────────────────────────────────────
# Application des migrations Doctrine
# --allow-no-migration : pas d'erreur si rien à migrer
# ─────────────────────────────────────────────────────────────
echo "🗄️  Application des migrations Doctrine..."
php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration

# ─────────────────────────────────────────────────────────────
# Nettoyage et warm-up du cache Symfony
# Indispensable en production pour les performances
# ─────────────────────────────────────────────────────────────
echo "🔥 Warm-up du cache Symfony..."
php bin/console cache:warmup --env=prod

# ─────────────────────────────────────────────────────────────
# Démarrage du serveur PHP intégré
# 0.0.0.0 : écoute sur toutes les interfaces du container
# -t public/ : racine web Symfony
# ─────────────────────────────────────────────────────────────
echo "🚀 Démarrage du Auth Service sur le port 8001..."
exec php -S 0.0.0.0:8001 -t public/