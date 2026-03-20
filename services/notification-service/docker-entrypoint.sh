#!/bin/bash
# docker-entrypoint.sh – Notification Service
# Exécuté automatiquement au démarrage du container
# set -e : arrête le script à la première erreur
set -e

# ─────────────────────────────────────────────────────────────
# Vérification que les dépendances sont installées
# Si node_modules/ n'existe pas, le service ne peut pas démarrer
# ─────────────────────────────────────────────────────────────
if [ ! -d "node_modules" ]; then
    echo "❌ Le dossier node_modules/ est absent."
    echo "👉 Lancez d'abord : ./setup.sh"
    exit 1
fi

# ─────────────────────────────────────────────────────────────
# Vérification que le build TypeScript existe
# dist/ est généré par setup.sh via npm run build
# ─────────────────────────────────────────────────────────────
if [ ! -f "dist/consumer.js" ]; then
    echo "❌ Le build TypeScript est absent (dist/consumer.js introuvable)."
    echo "👉 Lancez d'abord : ./setup.sh"
    exit 1
fi

# ─────────────────────────────────────────────────────────────
# Démarrage du consumer RabbitMQ
# Ce service n'a pas de BDD, pas de migrations à appliquer
# ─────────────────────────────────────────────────────────────
echo "🚀 Démarrage du Notification Service sur le port 8005..."
exec node dist/consumer.js