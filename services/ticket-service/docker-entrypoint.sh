#!/bin/bash
# docker-entrypoint.sh – Ticket Service
# Exécuté automatiquement au démarrage du container
# set -e : arrête le script à la première erreur
set -e

# Installation automatique des dépendances si node_modules/ est absent
if [ ! -d "node_modules" ]; then
    echo "Installation des dépendances npm..."
    npm install
    echo "Dépendances installées"
fi

# Build TypeScript automatique si dist/ est absent ou vide
if [ ! -f "dist/app.js" ]; then
    echo "Build TypeScript..."
    npm run build
    echo "Build terminé"
fi

# Attente que la base de données soit prête
echo "Attente de la base de données..."
MAX_RETRIES=30
RETRY_COUNT=0
until npx prisma migrate deploy 2>/dev/null; do
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
exec node dist/app.js