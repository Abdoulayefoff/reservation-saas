#!/bin/bash
# docker-entrypoint.sh – API Gateway
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
if [ ! -f "dist/app.js" ]; then
    echo "❌ Le build TypeScript est absent (dist/app.js introuvable)."
    echo "👉 Lancez d'abord : ./setup.sh"
    exit 1
fi

# ─────────────────────────────────────────────────────────────
# Démarrage de l'API Gateway
# Ce service n'a pas de BDD, pas de migrations à appliquer
# ─────────────────────────────────────────────────────────────
echo "🚀 Démarrage de l'API Gateway sur le port 8000..."
exec node dist/app.js