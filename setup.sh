#!/bin/bash
# setup.sh – Script d'initialisation du projet reservation-saas
# Lance l'intégralité du projet en une seule commande
# Usage : chmod +x setup.sh && ./setup.sh
#
# Ce script :
# 1. Vérifie les prérequis (Docker)
# 2. Configure le .env
# 3. Génère les secrets automatiquement
# 4. Build et démarre les containers
# 5. Installe les dépendances dans les containers
# 6. Génère les clés JWT
# 7. Exécute les migrations
# 8. Build les projets TypeScript et React
# 9. Vérifie que tout tourne

set -e  # Arrêter à la première erreur

# COULEURS ET FONCTIONS D'AFFICHAGE
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()    { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; }
section() { echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; \
            echo -e "${BLUE} $1${NC}"; \
            echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"; }

# FONCTION : Générer un secret aléatoire sécurisé
generate_secret() {
    openssl rand -hex 32
}

# FONCTION : Remplacer une variable dans .env
# Compatible macOS et Linux
replace_in_env() {
    local var_name=$1
    local new_value=$2
    local escaped_value=$(echo "$new_value" | sed 's/[&/\]/\\&/g')

    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^${var_name}=.*|${var_name}=${escaped_value}|" .env
    else
        sed -i "s|^${var_name}=.*|${var_name}=${escaped_value}|" .env
    fi
}

# FONCTION : Attendre qu'un container soit healthy
# $1 : nom du container
# $2 : timeout en secondes (défaut 120)
wait_healthy() {
    local container=$1
    local timeout=${2:-120}
    local elapsed=0

    info "Attente que $container soit healthy..."
    while [ $elapsed -lt $timeout ]; do
        local status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "not_found")
        if [ "$status" = "healthy" ]; then
            info "$container est healthy ✅"
            return 0
        fi
        sleep 3
        elapsed=$((elapsed + 3))
        echo -n "."
    done

    echo ""
    error "$container n'est pas healthy après ${timeout}s"
    error "Logs du container :"
    docker compose logs "$container" --tail=20
    exit 1
}

# ÉTAPE 1 – Vérification des prérequis
section "Étape 1/9 – Vérification des prérequis"

if ! command -v docker &> /dev/null; then
    error "Docker n'est pas installé."
    error "Installez Docker Desktop : https://www.docker.com/products/docker-desktop"
    exit 1
fi
info "Docker détecté ✅"

if ! docker compose version &> /dev/null; then
    error "Docker Compose n'est pas disponible."
    error "Mettez à jour Docker Desktop vers la version 24.x minimum."
    exit 1
fi
info "Docker Compose détecté ✅"

if ! docker info &> /dev/null; then
    error "Docker n'est pas démarré."
    error "Lancez Docker Desktop et réessayez."
    exit 1
fi
info "Docker est en cours d'exécution ✅"

# ÉTAPE 2 – Configuration du fichier .env
section "Étape 2/9 – Configuration de l'environnement"

if [ ! -f ".env.example" ]; then
    error "Le fichier .env.example est introuvable !"
    error "Assurez-vous d'être à la racine du projet."
    exit 1
fi

if [ ! -f ".env" ]; then
    warn ".env introuvable. Création depuis .env.example..."
    cp .env.example .env
    info ".env créé ✅"
else
    info ".env existe déjà ✅"
fi

# Charger les variables d'environnement
set -a
source .env
set +a

# ÉTAPE 3 – Génération automatique des secrets
section "Étape 3/9 – Génération des secrets"

SECRETS_GENERATED=0

# Générer JWT_SECRET si absent ou valeur par défaut
if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "change_me" ]; then
    warn "JWT_SECRET non configuré. Génération automatique..."
    NEW_JWT_SECRET=$(generate_secret)
    replace_in_env "JWT_SECRET" "$NEW_JWT_SECRET"
    JWT_SECRET=$NEW_JWT_SECRET
    SECRETS_GENERATED=1
    info "JWT_SECRET généré ✅"
fi

# Générer JWT_PASSPHRASE si absent ou valeur par défaut
if [ -z "$JWT_PASSPHRASE" ] || [ "$JWT_PASSPHRASE" = "change_me" ]; then
    warn "JWT_PASSPHRASE non configuré. Génération automatique..."
    NEW_JWT_PASSPHRASE=$(generate_secret)
    replace_in_env "JWT_PASSPHRASE" "$NEW_JWT_PASSPHRASE"
    JWT_PASSPHRASE=$NEW_JWT_PASSPHRASE
    SECRETS_GENERATED=1
    info "JWT_PASSPHRASE généré ✅"
fi

# Générer AUTH_DB_PASSWORD si absent ou valeur par défaut
if [ -z "$AUTH_DB_PASSWORD" ] || [ "$AUTH_DB_PASSWORD" = "change_me" ]; then
    warn "AUTH_DB_PASSWORD non configuré. Génération automatique..."
    NEW_SECRET=$(generate_secret)
    replace_in_env "AUTH_DB_PASSWORD" "$NEW_SECRET"
    AUTH_DB_PASSWORD=$NEW_SECRET
    SECRETS_GENERATED=1
    info "AUTH_DB_PASSWORD généré ✅"
fi

# Générer USER_DB_PASSWORD si absent ou valeur par défaut
if [ -z "$USER_DB_PASSWORD" ] || [ "$USER_DB_PASSWORD" = "change_me" ]; then
    warn "USER_DB_PASSWORD non configuré. Génération automatique..."
    NEW_SECRET=$(generate_secret)
    replace_in_env "USER_DB_PASSWORD" "$NEW_SECRET"
    USER_DB_PASSWORD=$NEW_SECRET
    SECRETS_GENERATED=1
    info "USER_DB_PASSWORD généré ✅"
fi

# Générer EVENT_DB_PASSWORD si absent ou valeur par défaut
if [ -z "$EVENT_DB_PASSWORD" ] || [ "$EVENT_DB_PASSWORD" = "change_me" ]; then
    warn "EVENT_DB_PASSWORD non configuré. Génération automatique..."
    NEW_SECRET=$(generate_secret)
    replace_in_env "EVENT_DB_PASSWORD" "$NEW_SECRET"
    EVENT_DB_PASSWORD=$NEW_SECRET
    SECRETS_GENERATED=1
    info "EVENT_DB_PASSWORD généré ✅"
fi

# Générer TICKET_DB_PASSWORD si absent ou valeur par défaut
if [ -z "$TICKET_DB_PASSWORD" ] || [ "$TICKET_DB_PASSWORD" = "change_me" ]; then
    warn "TICKET_DB_PASSWORD non configuré. Génération automatique..."
    NEW_SECRET=$(generate_secret)
    replace_in_env "TICKET_DB_PASSWORD" "$NEW_SECRET"
    TICKET_DB_PASSWORD=$NEW_SECRET
    SECRETS_GENERATED=1
    info "TICKET_DB_PASSWORD généré ✅"
fi

# Générer RABBITMQ_PASSWORD si absent ou valeur par défaut
if [ -z "$RABBITMQ_PASSWORD" ] || [ "$RABBITMQ_PASSWORD" = "change_me" ]; then
    warn "RABBITMQ_PASSWORD non configuré. Génération automatique..."
    NEW_SECRET=$(generate_secret)
    replace_in_env "RABBITMQ_PASSWORD" "$NEW_SECRET"
    RABBITMQ_PASSWORD=$NEW_SECRET
    SECRETS_GENERATED=1
    info "RABBITMQ_PASSWORD généré ✅"
fi

if [ $SECRETS_GENERATED -eq 1 ]; then
    info "Secrets générés et sauvegardés dans .env ✅"
    warn "Ne commitez JAMAIS le fichier .env sur Git !"

    # Recharger .env avec les nouvelles valeurs
    set -a
    source .env
    set +a

    # ── Recalcul des URLs composites ────────────────────────────
    # Les DATABASE_URLs et RABBITMQ_URL utilisent les mots de passe
    # générés ci-dessus. Il faut les mettre à jour dans .env.
    info "Mise à jour des URLs de connexion..."

    replace_in_env "AUTH_DATABASE_URL" "postgresql://${AUTH_DB_USER}:${AUTH_DB_PASSWORD}@${AUTH_DB_HOST}:${AUTH_DB_PORT}/${AUTH_DB_NAME}?serverVersion=16\&charset=utf8"
    replace_in_env "USER_DATABASE_URL" "postgresql://${USER_DB_USER}:${USER_DB_PASSWORD}@${USER_DB_HOST}:${USER_DB_PORT}/${USER_DB_NAME}?serverVersion=16\&charset=utf8"
    replace_in_env "EVENT_DATABASE_URL" "postgresql://${EVENT_DB_USER}:${EVENT_DB_PASSWORD}@${EVENT_DB_HOST}:${EVENT_DB_PORT}/${EVENT_DB_NAME}?serverVersion=16\&charset=utf8"
    replace_in_env "TICKET_DATABASE_URL" "postgresql://${TICKET_DB_USER}:${TICKET_DB_PASSWORD}@${TICKET_DB_HOST}:${TICKET_DB_PORT}/${TICKET_DB_NAME}?serverVersion=16\&charset=utf8"
    replace_in_env "RABBITMQ_URL" "amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@${RABBITMQ_HOST}:${RABBITMQ_PORT}/"

    info "URLs de connexion mises à jour ✅"

    # Recharger une dernière fois avec les URLs mises à jour
    set -a
    source .env
    set +a
fi

# ÉTAPE 4 – Build et démarrage des containers
section "Étape 4/9 – Build et démarrage des containers"

info "Construction des images Docker..."
info "Cette étape peut prendre plusieurs minutes lors de la première installation..."
docker compose build

info "Démarrage des containers de base (BDD + RabbitMQ)..."
docker compose up -d auth-db user-db event-db ticket-db rabbitmq

# Attendre que les BDD et RabbitMQ soient healthy avant de continuer
wait_healthy "reservation_auth_db"
wait_healthy "reservation_user_db"
wait_healthy "reservation_event_db"
wait_healthy "reservation_ticket_db"
wait_healthy "reservation_rabbitmq" 180

# ÉTAPE 5 – Installation des dépendances dans les containers
section "Étape 5/9 – Installation des dépendances"

# Démarrer les services sans les healthchecks pour pouvoir
# exécuter composer install / npm install dedans
info "Démarrage des services pour installation des dépendances..."
docker compose up -d --no-healthcheck \
    auth-service user-service event-service \
    ticket-service notification-service api-gateway \
    frontend

sleep 5

# ── Symfony Services ──────────────────────────────────────────

info "Installation des dépendances Auth Service (composer)..."
docker compose exec -T auth-service composer install \
    --no-interaction --optimize-autoloader
info "Auth Service – dépendances installées ✅"

info "Installation des dépendances User Service (composer)..."
docker compose exec -T user-service composer install \
    --no-interaction --optimize-autoloader
info "User Service – dépendances installées ✅"

info "Installation des dépendances Event Service (composer)..."
docker compose exec -T event-service composer install \
    --no-interaction --optimize-autoloader
info "Event Service – dépendances installées ✅"

# ── Node.js Services ──────────────────────────────────────────

info "Installation des dépendances Ticket Service (npm)..."
docker compose exec -T ticket-service npm install
info "Ticket Service – dépendances installées ✅"

info "Installation des dépendances Notification Service (npm)..."
docker compose exec -T notification-service npm install
info "Notification Service – dépendances installées ✅"

info "Installation des dépendances API Gateway (npm)..."
docker compose exec -T api-gateway npm install
info "API Gateway – dépendances installées ✅"

info "Installation des dépendances Frontend (npm)..."
docker compose exec -T frontend npm install
info "Frontend – dépendances installées ✅"

# ÉTAPE 6 – Génération des clés JWT
section "Étape 6/9 – Génération des clés JWT"

info "Génération des clés JWT pour Auth Service..."
docker compose exec -T auth-service php bin/console \
    lexik:jwt:generate-keypair --overwrite --no-interaction
info "Clés JWT générées ✅"

# ÉTAPE 7 – Migrations de base de données
section "Étape 7/9 – Migrations de base de données"

# ── Symfony Migrations ────────────────────────────────────────

info "Migrations Auth Service..."
docker compose exec -T auth-service php bin/console \
    doctrine:migrations:migrate --no-interaction --allow-no-migration
info "Auth Service – migrations OK ✅"

info "Migrations User Service..."
docker compose exec -T user-service php bin/console \
    doctrine:migrations:migrate --no-interaction --allow-no-migration
info "User Service – migrations OK ✅"

info "Migrations Event Service..."
docker compose exec -T event-service php bin/console \
    doctrine:migrations:migrate --no-interaction --allow-no-migration
info "Event Service – migrations OK ✅"

# ── Prisma Migrations ─────────────────────────────────────────

info "Migrations Ticket Service (Prisma)..."
docker compose exec -T ticket-service npx prisma migrate deploy
info "Ticket Service – migrations OK ✅"

# ÉTAPE 8 – Build TypeScript et React
section "Étape 8/9 – Build des projets"

info "Build TypeScript – Ticket Service..."
docker compose exec -T ticket-service npm run build
info "Ticket Service – build OK ✅"

info "Build TypeScript – Notification Service..."
docker compose exec -T notification-service npm run build
info "Notification Service – build OK ✅"

info "Build TypeScript – API Gateway..."
docker compose exec -T api-gateway npm run build
info "API Gateway – build OK ✅"

info "Build React – Frontend..."
docker compose exec -T frontend npm run build
info "Frontend – build OK ✅"

# ÉTAPE 9 – Redémarrage final et vérification
section "Étape 9/9 – Démarrage final et vérification"

info "Redémarrage de tous les services..."
docker compose up -d

# Attendre que tous les services soient healthy
wait_healthy "reservation_auth_service" 120
wait_healthy "reservation_user_service" 120
wait_healthy "reservation_event_service" 120
wait_healthy "reservation_ticket_service" 120
wait_healthy "reservation_notification_service" 120
wait_healthy "reservation_api_gateway" 120
wait_healthy "reservation_nginx" 60

info "Vérification des endpoints /health..."

# Vérifier chaque service via curl
services_ok=0
check_health() {
    local name=$1
    local url=$2
    if curl -sf "$url" > /dev/null 2>&1; then
        info "$name – /health OK ✅"
    else
        warn "$name – /health ne répond pas encore"
        services_ok=1
    fi
}

check_health "Nginx"               "http://localhost/health"
check_health "Auth Service"        "http://localhost/api/auth/health"
check_health "User Service"        "http://localhost/api/users/health"
check_health "Event Service"       "http://localhost/api/events/health"
check_health "Ticket Service"      "http://localhost/api/tickets/health"

# RÉSUMÉ FINAL
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN} ✅  Installation terminée avec succès !${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  🌐 Application       : http://localhost"
echo "  🔐 Auth Service      : http://localhost/api/auth"
echo "  👤 User Service      : http://localhost/api/users"
echo "  🎫 Event Service     : http://localhost/api/events"
echo "  🎟️  Ticket Service    : http://localhost/api/tickets"
echo "  🐰 RabbitMQ UI       : http://localhost:15672"
echo "  📚 Swagger Auth      : http://localhost:8001/api/doc"
echo "  📚 Swagger User      : http://localhost:8002/api/doc"
echo "  📚 Swagger Event     : http://localhost:8003/api/doc"
echo "  📚 Swagger Ticket    : http://localhost:8004/api-docs"
echo "  📚 Swagger Gateway   : http://localhost:8000/api-docs"
echo ""
echo "  Commandes utiles :"
echo "  make up      – Démarrer les containers"
echo "  make down    – Arrêter les containers"
echo "  make logs    – Voir les logs"
echo "  make test    – Lancer les tests"
echo "  make ps      – État des containers"
echo ""