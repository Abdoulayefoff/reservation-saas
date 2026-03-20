#!/bin/sh
# docker-entrypoint.sh – Notification Service
# Pas de migrations – démarre directement le consumer RabbitMQ
set -e

# Démarrage du consumer RabbitMQ
# consumer.js écoute la queue ticket.confirmed en continu
echo "🚀 Démarrage du Notification Service sur le port 8005..."
exec node dist/consumer.js