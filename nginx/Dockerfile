# Dockerfile – Nginx Load Balancer
# Image légère alpine, sert uniquement de reverse proxy

# Image de base Nginx officielle en version alpine (légère)
FROM nginx:alpine

# Supprimer la configuration Nginx par défaut pour éviter tout conflit avec notre config personnalisée
RUN rm /etc/nginx/conf.d/default.conf

# Copier notre configuration personnalisée dans le container
COPY nginx.conf /etc/nginx/nginx.conf

# Exposer le port 80 (seul port accessible depuis l'extérieur)
EXPOSE 80

# Healthcheck Docker – vérifie que Nginx répond bien
# --interval  : vérification toutes les 10s
# --timeout   : abandon après 5s sans réponse
# --retries   : 3 échecs consécutifs = container unhealthy
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/health || exit 1

# Lancer Nginx en premier plan (obligatoire pour Docker)
CMD ["nginx", "-g", "daemon off;"]