#!/bin/bash
# docker-entrypoint.sh – Ticket Service
# Exécuté automatiquement au démarrage du container
# set -e : arrête le script à la première erreur
set -e

# Synchronisation des dépendances npm (détecte les nouvelles depuis le dernier build)
echo "Synchronisation des dépendances npm..."
npm install --prefer-offline
echo "Dépendances OK"

# Build TypeScript automatique si dist/ est absent ou si les sources sont plus récentes
if [ ! -f "dist/server.js" ] || [ "$(find src -name '*.ts' -newer dist/server.js 2>/dev/null | head -1)" != "" ]; then
    echo "Build TypeScript..."
    npm run build
    echo "Build terminé"
fi

# Attente que la base de données soit prête
echo "Attente de la base de données..."
MAX_RETRIES=30
RETRY_COUNT=0
until npx prisma db push --force-reset 2>/dev/null; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "La base de données n'est pas accessible après ${MAX_RETRIES} tentatives"
        exit 1
    fi
    echo "  Tentative $RETRY_COUNT/$MAX_RETRIES..."
    sleep 2
done
echo "Migrations Prisma appliquées"

# Démarrage du service Node.js compilé
echo "Démarrage du Ticket Service sur le port 8004..."
exec node dist/server.js