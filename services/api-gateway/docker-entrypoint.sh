#!/bin/sh
# docker-entrypoint.sh – API Gateway
# Pas de BDD ni migrations – démarre directement le serveur
set -e

# Démarrage du serveur Express
# app.js gère le routing vers tous les microservices
echo "🚀 Démarrage de l'API Gateway sur le port 8000..."
exec node dist/app.js