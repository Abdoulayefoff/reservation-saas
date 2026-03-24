#!/bin/bash
# docker-entrypoint.sh – API Gateway
# Exécuté automatiquement au démarrage du container
# set -e : arrête le script à la première erreur
set -e

# Synchronisation des dépendances npm (détecte les nouvelles depuis le dernier build)
echo "Synchronisation des dépendances npm..."
npm install --prefer-offline
echo "Dépendances OK"

# Build TypeScript automatique si dist/ est absent ou si les sources sont plus récentes
if [ ! -f "dist/app.js" ] || [ "$(find src -name '*.ts' -newer dist/app.js 2>/dev/null | head -1)" != "" ]; then
    echo "Build TypeScript..."
    npm run build
    echo "Build terminé"
fi

# Démarrage de l'API Gateway
# Ce service n'a pas de BDD, pas de migrations à appliquer
echo "Démarrage de l'API Gateway sur le port 8000..."
exec node dist/app.js