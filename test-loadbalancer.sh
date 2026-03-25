#!/bin/bash
# test-loadbalancer.sh  —  Vérification du Weighted Round-Robin (60/40)
# Usage : ./test-loadbalancer.sh
# Pré-requis : docker compose up -d (tous les services sains)

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

GATEWAY="http://localhost:8000"
CONTAINER_1="reservation-saas-ticket-service-1-1"
CONTAINER_2="reservation-saas-ticket-service-2-1"
TEST_EMAIL="lb_test_$(date +%s)@demo.com"
TEST_PASSWORD="Test1234!"

separator() { echo -e "${CYAN}---------------------------------------------------${NC}"; }

# Obtenir un token JWT
get_token() {
  curl -s -X POST "$GATEWAY/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"firstName\":\"LB\",\"lastName\":\"Test\"}" \
    > /dev/null 2>&1

  curl -s -X POST "$GATEWAY/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null
}

# Envoyer 1 requête et retourner (served_by, http_code)
one_request() {
  local token=$1
  local served http_code
  served=$(curl -s -D - -o /dev/null \
    -H "Authorization: Bearer $token" \
    "$GATEWAY/api/tickets" \
    | grep -i "x-served-by" | tr -d '\r' | awk '{print $2}')
  http_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $token" \
    "$GATEWAY/api/tickets")
  echo "$served $http_code"
}

echo ""
echo -e "${BOLD}${YELLOW}--------------------------------------------------------${NC}"
echo -e "${BOLD}${YELLOW}║     TEST WEIGHTED ROUND-ROBIN — ticket-service       ║${NC}"
echo -e "${BOLD}${YELLOW}║     Ratio attendu : ticket-service-1=60%  -2=40%     ║${NC}"
echo -e "${BOLD}${YELLOW}--------------------------------------------------------${NC}"
echo ""

# Étape 0 : Vérification que les deux instances sont saines
separator
echo -e "${BOLD}[Étape 0] Vérification des instances...${NC}"
echo ""

for cname in "$CONTAINER_1" "$CONTAINER_2"; do
  status=$(docker inspect --format='{{.State.Health.Status}}' "$cname" 2>/dev/null)
  if [[ "$status" == "healthy" ]]; then
    echo -e "  ${GREEN}✓${NC}  $cname  →  ${GREEN}healthy${NC}"
  else
    echo -e "  ${RED}✗${NC}  $cname  →  ${RED}${status:-introuvable}${NC}"
    echo -e "${RED}  Arrêt : une instance n'est pas prête. Lance d'abord : docker compose up -d${NC}"
    exit 1
  fi
done

# Étape 1 : Authentification
echo ""
separator
echo -e "${BOLD}[Étape 1] Obtention d'un token JWT...${NC}"
TOKEN=$(get_token)
if [[ -z "$TOKEN" ]]; then
  echo -e "${RED}  ✗ Impossible d'obtenir un token. Le gateway est-il démarré ?${NC}"
  exit 1
fi
echo -e "  ${GREEN}✓${NC}  Token obtenu (${TOKEN:0:30}...)"

# Étape 2 : 10 requêtes — 1 cycle complet du pool
echo ""
separator
echo -e "${BOLD}[Étape 2] Envoi de 10 requêtes (= 1 cycle complet du pool)${NC}"
echo -e "  Pool pondéré : [url1 x6, url2 x4] — parcouru en boucle via index modulo 10"
echo ""

COUNT_1=0; COUNT_2=0

for ((i=1; i<=10; i++)); do
  served=$(curl -s -D - -o /dev/null \
    -H "Authorization: Bearer $TOKEN" \
    "$GATEWAY/api/tickets" \
    | grep -i "x-served-by" | tr -d '\r' | awk '{print $2}')

  if [[ "$served" == "ticket-service-1" ]]; then
    ((COUNT_1++))
    echo -e "  Requête ${i}   →  ${GREEN}ticket-service-1 (weight=6)${NC}"
  elif [[ "$served" == "ticket-service-2" ]]; then
    ((COUNT_2++))
    echo -e "  Requête ${i}   →  ${YELLOW}ticket-service-2 (weight=4)${NC}"
  else
    echo -e "  Requête ${i}   →  ${RED}[429 rate-limit ou erreur]${NC}"
  fi
done

echo ""
echo -e "  ${BOLD}Résultats sur 10 requêtes :${NC}"
echo -e "    ${GREEN}ticket-service-1${NC} (poids 6, attendu 60%) : ${BOLD}${COUNT_1}/10${NC}"
echo -e "    ${YELLOW}ticket-service-2${NC} (poids 4, attendu 40%) : ${BOLD}${COUNT_2}/10${NC}"

if [[ $COUNT_1 -eq 6 && $COUNT_2 -eq 4 ]]; then
  echo -e "  ${GREEN}${BOLD}✓ Distribution exacte 6/4 — CORRECT${NC}"
else
  echo -e "  ${RED}✗ Distribution inattendue (attendu 6/4)${NC}"
fi

# Pause pour réinitialiser la fenêtre du rate limiter (100 req/min)
echo ""
echo -e "  ${CYAN}⏳ Pause 65s pour réinitialiser le rate limiter (100 req/min)...${NC}"
sleep 65

# ─── Étape 3 : 20 requêtes — vérification du ratio 60/40 sur 2 cycles ────────
echo ""
separator
echo -e "${BOLD}[Étape 3] Envoi de 20 requêtes (2 cycles complets — vérification ratio)${NC}"
echo ""

BIG_COUNT_1=0; BIG_COUNT_2=0

for ((i=1; i<=20; i++)); do
  served=$(curl -s -D - -o /dev/null \
    -H "Authorization: Bearer $TOKEN" \
    "$GATEWAY/api/tickets" \
    | grep -i "x-served-by" | tr -d '\r' | awk '{print $2}')

  if [[ "$served" == "ticket-service-1" ]]; then
    ((BIG_COUNT_1++))
    echo -e "  Requête ${i}   →  ${GREEN}ticket-service-1${NC}   [total instance-1: ${BIG_COUNT_1}]"
  elif [[ "$served" == "ticket-service-2" ]]; then
    ((BIG_COUNT_2++))
    echo -e "  Requête ${i}   →  ${YELLOW}ticket-service-2${NC}   [total instance-2: ${BIG_COUNT_2}]"
  else
    echo -e "  Requête ${i}   →  ${RED}[erreur]${NC}"
  fi
done

TOTAL_BIG=$((BIG_COUNT_1 + BIG_COUNT_2))
echo ""
echo -e "  ${BOLD}Résultats sur 20 requêtes :${NC}"
echo -e "    ${GREEN}ticket-service-1${NC} : ${BOLD}${BIG_COUNT_1}/20${NC}  (attendu 12 = 60%)"
echo -e "    ${YELLOW}ticket-service-2${NC} : ${BOLD}${BIG_COUNT_2}/20${NC}  (attendu 8  = 40%)"

if [[ $BIG_COUNT_1 -eq 12 && $BIG_COUNT_2 -eq 8 ]]; then
  echo -e "  ${GREEN}${BOLD}✓ Ratio exactement 60/40 sur 2 cycles complets — PARFAIT${NC}"
elif [[ $TOTAL_BIG -eq 20 ]]; then
  PCT_1=$(echo "scale=0; $BIG_COUNT_1 * 100 / $TOTAL_BIG" | bc)
  PCT_2=$(echo "scale=0; $BIG_COUNT_2 * 100 / $TOTAL_BIG" | bc)
  echo -e "  ${YELLOW}⚠ Ratio obtenu : ${PCT_1}% / ${PCT_2}% (cycle entamé à un index non-zéro)${NC}"
else
  echo -e "  ${RED}✗ Seulement $TOTAL_BIG/20 réponses valides — vérifie les logs${NC}"
fi

# Pause rate limiter
echo ""
echo -e "  ${CYAN}⏳ Pause 65s pour réinitialiser le rate limiter avant la panne...${NC}"
sleep 65

# Étape 4 : Simulation de panne — arrêt de ticket-service-1
echo ""
separator
echo -e "${BOLD}[Étape 4] Simulation de panne — arrêt de ticket-service-1${NC}"
echo -e "  Comportement attendu : les requêtes vers instance-1 → 502, instance-2 → 200"
echo ""

docker stop "$CONTAINER_1" > /dev/null 2>&1
echo -e "  ${RED}✗${NC}  $CONTAINER_1 arrêté."
echo ""
echo -e "  Envoi de 10 requêtes sondes (pool continue de tourner : 6x502 + 4x200 par cycle)..."
echo ""

PANNE_1=0; PANNE_2=0; PANNE_ERR=0
for ((i=1; i<=10; i++)); do
  served=$(curl -s -D - -o /dev/null \
    -H "Authorization: Bearer $TOKEN" \
    "$GATEWAY/api/tickets" \
    | grep -i "x-served-by" | tr -d '\r' | awk '{print $2}')
  http_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    "$GATEWAY/api/tickets")

  if [[ "$served" == "ticket-service-2" ]]; then
    ((PANNE_2++))
    echo -e "  Requête ${i}  →  ${YELLOW}ticket-service-2${NC}  HTTP ${GREEN}${http_code}${NC}  ✓"
  elif [[ "$served" == "ticket-service-1" ]]; then
    ((PANNE_1++))
    echo -e "  Requête ${i}  →  ${RED}ticket-service-1 (DOWN)${NC}  HTTP ${RED}${http_code}${NC}  ✗"
  else
    ((PANNE_ERR++))
    echo -e "  Requête ${i}  →  ${RED}502 Bad Gateway${NC}  (instance-1 DOWN, pool la cible quand même)  HTTP ${RED}${http_code}${NC}"
  fi
done

echo ""
echo -e "  ${BOLD}Résultats panne :${NC}"
echo -e "    ${YELLOW}ticket-service-2${NC} (actif)       : ${PANNE_2}/10  requêtes servies"
echo -e "    ${RED}ticket-service-1${NC} (arrêté)      : ${PANNE_1}/10  (doit être 0)"
echo -e "    ${RED}Erreurs 502${NC} (pool cible DOWN)  : ${PANNE_ERR}/10"
echo ""
echo -e "  ${YELLOW}ℹ  Note : les 502 correspondent aux slots du pool assignés à instance-1.${NC}"
echo -e "  ${YELLOW}   Notre load balancer est Round-Robin pur (sans health-check actif).${NC}"
echo -e "  ${YELLOW}   En production, Nginx/HAProxy marquerait l'instance DOWN automatiquement.${NC}"

# Pause rate limiter
echo ""
echo -e "  ${CYAN}⏳ Pause 65s pour réinitialiser le rate limiter avant la reprise...${NC}"
sleep 65

# Étape 5 : Redémarrage de ticket-service-1
echo ""
separator
echo -e "${BOLD}[Étape 5] Redémarrage de ticket-service-1 — récupération automatique${NC}"
echo ""

docker start "$CONTAINER_1" > /dev/null 2>&1
echo -e "  ${GREEN}✓${NC}  $CONTAINER_1 redémarré — attente du healthcheck..."

until [[ "$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_1" 2>/dev/null)" == "healthy" ]]; do
  sleep 3
  echo -ne "  ."
done
echo ""
echo -e "  ${GREEN}✓${NC}  $CONTAINER_1 est à nouveau ${GREEN}healthy${NC}."
echo ""
echo -e "  Envoi de 10 requêtes — les deux instances doivent reprendre le trafic..."
echo ""

RECOV_1=0; RECOV_2=0; RECOV_ERR=0
for ((i=1; i<=10; i++)); do
  served=$(curl -s -D - -o /dev/null \
    -H "Authorization: Bearer $TOKEN" \
    "$GATEWAY/api/tickets" \
    | grep -i "x-served-by" | tr -d '\r' | awk '{print $2}')

  if [[ "$served" == "ticket-service-1" ]]; then
    ((RECOV_1++))
    echo -e "  Requête ${i}   →  ${GREEN}ticket-service-1${NC}  ✓"
  elif [[ "$served" == "ticket-service-2" ]]; then
    ((RECOV_2++))
    echo -e "  Requête ${i}   →  ${YELLOW}ticket-service-2${NC}  ✓"
  else
    ((RECOV_ERR++))
    echo -e "  Requête ${i}   →  ${RED}[erreur]${NC}"
  fi
done

echo ""
echo -e "  ${BOLD}Résultats après redémarrage :${NC}"
echo -e "    ${GREEN}ticket-service-1${NC} : ${RECOV_1}/10"
echo -e "    ${YELLOW}ticket-service-2${NC} : ${RECOV_2}/10"

if [[ $RECOV_1 -gt 0 && $RECOV_2 -gt 0 ]]; then
  echo -e "  ${GREEN}${BOLD}✓ Les deux instances reçoivent à nouveau du trafic — RÉCUPÉRATION OK${NC}"
elif [[ $RECOV_ERR -gt 5 ]]; then
  echo -e "  ${RED}✗ Trop d'erreurs — instance-1 peut ne pas être prête, relance le script${NC}"
fi

# Résumé final
echo ""
separator
echo -e "${BOLD}${GREEN}RÉSUMÉ FINAL${NC}"
echo ""
echo -e "  ${BOLD}Étape 2${NC} — 10 req  (1 cycle)  :  instance-1=${COUNT_1}  instance-2=${COUNT_2}  ${GREEN}(attendu 6/4)${NC}"
echo -e "  ${BOLD}Étape 3${NC} — 20 req  (2 cycles) :  instance-1=${BIG_COUNT_1}  instance-2=${BIG_COUNT_2}  ${GREEN}(attendu 12/8)${NC}"
echo -e "  ${BOLD}Étape 4${NC} — panne   instance-1 :  instance-2 ok=${PANNE_2}  erreurs 502=${PANNE_ERR}"
echo -e "  ${BOLD}Étape 5${NC} — reprise instance-1 :  instance-1=${RECOV_1}  instance-2=${RECOV_2}"
echo ""
separator
echo ""
