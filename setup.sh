#!/usr/bin/env bash
# setup.sh – Initialisation du projet reservation-saas

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'

step()    { echo -e "\n${BOLD}▶ $1${NC}"; }
success() { echo -e "${GREEN}✓ $1${NC}"; }
warn()    { echo -e "${YELLOW}⚠  $1${NC}"; }
die()     { echo -e "${RED}✗ ERREUR : $1${NC}" >&2; echo -e "${YELLOW}  → $2${NC}" >&2; exit 1; }

echo -e "${BOLD}║   reservation-saas – Initialisation      ║${NC}"

# ÉTAPE 1 – Vérification des prérequis
step "Étape 1/4 – Vérification des prérequis"

command -v docker &>/dev/null || die "Docker n'est pas installé." "https://docs.docker.com/get-docker/"
docker info &>/dev/null       || die "Docker n'est pas démarré." "Lancez Docker Desktop et réessayez."
docker compose version &>/dev/null || die "Docker Compose v2 manquant." "Mettez à jour Docker Desktop."
command -v git &>/dev/null    || die "Git n'est pas installé." "https://git-scm.com/"

success "Docker détecté"
success "Docker Compose disponible"
success "Git détecté"

# ÉTAPE 2 – Configuration .env
step "Étape 2/4 – Configuration de l'environnement"

if [ -f ".env" ]; then
    warn "Le fichier .env existe déjà, conservation de la config existante."
else
    [ -f ".env.example" ] || die ".env.example introuvable." "Vérifiez que vous êtes à la racine du projet."
    cp .env.example .env
    success "Fichier .env créé depuis .env.example"
    warn "Pensez à modifier les mots de passe dans .env avant la production !"
fi

# ÉTAPE 3 – Build des images Docker
step "Étape 3/4 – Build des images Docker"

docker compose build --parallel || die "Le build Docker a échoué." "Lancez 'docker compose build' pour voir les erreurs."
success "Images Docker construites"

# ÉTAPE 4 – Démarrage des containers
step "Étape 4/4 – Démarrage des containers"

docker compose up -d || die "Le démarrage a échoué." "Lancez 'docker compose logs' pour diagnostiquer."
success "Containers démarrés"

echo ""
echo -e "${BOLD}║  🎉  Projet initialisé avec succès !                     ║${NC}"
echo -e "${BOLD}║  • Application  : http://localhost                       ║${NC}"
echo -e "${BOLD}║  • RabbitMQ UI  : http://localhost:15672                 ║${NC}"
echo -e "${BOLD}║  Commandes : make ps | make logs | make down             ║${NC}"
