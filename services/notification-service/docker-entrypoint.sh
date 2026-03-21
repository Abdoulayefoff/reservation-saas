#!/bin/bash
# docker-entrypoint.sh – Notification Service
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
if [ ! -f "dist/consumer.js" ]; then
    echo "Build TypeScript..."
    npm run build
    echo "Build terminé"
fi

# Démarrage du consumer RabbitMQ
# Ce service n'a pas de BDD, pas de migrations à appliquer
echo "Démarrage du Notification Service sur le port 8005..."
exec node dist/consumer.js