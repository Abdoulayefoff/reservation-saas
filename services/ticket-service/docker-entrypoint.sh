#!/bin/sh
# docker-entrypoint.sh – Ticket Service
# Applique les migrations Prisma puis démarre le serveur
set -e

# Appliquer les migrations Prisma
# migrate deploy : applique les migrations en production (pas migrate dev)
echo "🗄️  Application des migrations Prisma..."
npx prisma migrate deploy

# Démarrage du serveur Node.js compilé
echo "🚀 Démarrage du Ticket Service sur le port 8004..."
exec node dist/app.js