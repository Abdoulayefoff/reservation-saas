# SaaS Réservation de Billets – 4WEBD

> Plateforme de réservation de billets pour événements musicaux, construite en architecture microservices.

![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)
![Symfony](https://img.shields.io/badge/Symfony-7-000000?logo=symfony)
![Node.js](https://img.shields.io/badge/Node.js-20_LTS-339933?logo=node.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3-FF6600?logo=rabbitmq)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)

---

## 1. Architecture

```
                          ┌─────────────────────────────────────┐
                          │         frontend_network             │
  Navigateur ──── :80 ──▶ │  Nginx (Load Balancer)               │
                          │     │            │                   │
                          │  Frontend     API Gateway :8000       │
                          └─────────────────────────────────────┘
                                                │
                          ┌─────────────────────▼───────────────┐
                          │          backend_network             │
                          │                                      │
                          │  Auth Service    :8001  (Symfony 7)  │
                          │  User Service    :8002  (Symfony 7)  │
                          │  Event Service   :8003  (Symfony 7)  │
                          │  Ticket Service  :8004  (Node.js)    │
                          │  Notif. Service  :8005  (Node.js)    │
                          │                                      │
                          │  PostgreSQL x4   :5432-5435          │
                          │  RabbitMQ        :5672 / :15672      │
                          └─────────────────────────────────────┘
```

**Flux de messagerie asynchrone :**
`Ticket Service` → publie sur exchange `ticket_events` (topic) → queue `ticket.confirmed` → `Notification Service` consomme

---

## 2. Technologies

| Composant            | Technologie               | Version  |
|----------------------|---------------------------|----------|
| Frontend             | React + TypeScript + Vite | 19 / 5   |
| CSS Framework        | TailwindCSS               | 3.x      |
| Auth Service         | Symfony + LexikJWT        | 7.x      |
| User Service         | Symfony                   | 7.x      |
| Event Service        | Symfony                   | 7.x      |
| Ticket Service       | Node.js + Express + Prisma| 20 LTS   |
| Notification Service | Node.js + Express + AMQP  | 20 LTS   |
| API Gateway          | Node.js + Express         | 20 LTS   |
| Base de données      | PostgreSQL                | 16       |
| Broker de messages   | RabbitMQ                  | 3        |
| Reverse Proxy        | Nginx                     | alpine   |
| ORM PHP              | Doctrine Migrations       | 3.x      |
| ORM Node.js          | Prisma                    | 5.x      |
| Tests PHP            | PHPUnit                   | 10.x     |
| Tests Node.js        | Jest                      | 29.x     |

---

## 3. Prérequis

| Outil          | Version minimale | Vérification             |
|----------------|------------------|--------------------------|
| Git            | 2.x              | `git --version`          |
| Docker Desktop | 24.x             | `docker --version`       |
| Docker Compose | v2 (intégré)     | `docker compose version` |

> **Note :** PHP, Composer, Node.js et Symfony CLI ne sont **pas** nécessaires sur la machine hôte. Toutes les dépendances sont installées dans les containers Docker.

---

## 4. Installation et lancement

### Première installation (clone frais)

```bash
# 1. Cloner le dépôt
git clone https://github.com/Abdoulayefoff/reservation-saas.git
cd reservation-saas

# 2. Lancer le script d'initialisation (tout-en-un)
chmod +x setup.sh && ./setup.sh
```

Le script `setup.sh` effectue automatiquement :

1. Vérification des prérequis (Docker, Git)
2. Copie `.env.example` → `.env` et génère les secrets
3. Build des images Docker (`docker compose build`)
4. Démarrage des containers (`docker compose up -d`)
5. Génération des clés JWT RSA (dans auth-service)
6. Migrations Doctrine (auth, user, event services)
7. Migration Prisma (ticket-service)
8. Vérification finale des healthchecks

L'application est ensuite accessible sur **http://localhost**

### Lancement classique (après la première installation)

```bash
make up
```

### Arrêt

```bash
make down
```

### Nettoyage complet (reset de zéro)

```bash
docker compose down -v --rmi all
```

---

## 5. Lancement des tests

### Tous les tests (PHPUnit + Jest)

```bash
make test
```

### Tests backend uniquement (PHPUnit – Symfony)

```bash
make test-backend
```

Exécute PHPUnit sur : auth-service, user-service, event-service.

### Tests Node.js uniquement (Jest)

```bash
make test-node
```

Exécute Jest sur : api-gateway, ticket-service, notification-service.

### Rapport de couverture HTML (services PHP)

```bash
make test-coverage
```

Les rapports sont générés dans `build/coverage/` de chaque service.

---

## 6. Documentation API (Swagger)

| Service            | URL Swagger                     |
|--------------------|---------------------------------|
| Auth Service       | http://localhost:8001/api/doc   |
| User Service       | http://localhost:8002/api/doc   |
| Event Service      | http://localhost:8003/api/doc   |
| Ticket Service     | http://localhost:8004/api-docs  |
| RabbitMQ UI        | http://localhost:15672          |

> Credentials RabbitMQ : définis dans `.env` (`RABBITMQ_USER` / `RABBITMQ_PASSWORD`)

---

## 7. Structure du projet

```
reservation-saas/
├── setup.sh                          ← Script d'initialisation tout-en-un
├── Makefile                          ← Commandes du quotidien
├── docker-compose.yml                ← Orchestration de tous les services
├── .env.example                      ← Template de configuration (à copier en .env)
│
├── nginx/                            ← Configuration Nginx (Load Balancer)
│   ├── Dockerfile
│   └── nginx.conf
│
├── frontend/                         ← SPA React 19 + TypeScript + Vite
│   ├── src/
│   │   ├── api/axios.ts              ← Client HTTP (JWT auto-injecté)
│   │   ├── context/AuthContext.tsx   ← Gestion état auth global
│   │   ├── components/               ← EventCard, Navbar, AppLayout, Toast
│   │   └── pages/                    ← Home, Login, Register, Dashboard, MyTickets
│   └── Dockerfile
│
└── services/
    ├── api-gateway/                  ← Node.js/Express – Routing + Validation JWT
    ├── auth-service/                 ← Symfony 7 – Authentification + JWT RS256
    ├── user-service/                 ← Symfony 7 – Profils utilisateurs
    ├── event-service/                ← Symfony 7 – Gestion des événements
    ├── ticket-service/               ← Node.js – Achat billets + RabbitMQ publisher
    │   └── prisma/                   ← Schéma et migrations Prisma
    └── notification-service/         ← Node.js – Consumer RabbitMQ
```

---

## 8. Variables d'environnement

Copier `.env.example` en `.env` (fait automatiquement par `setup.sh`).

| Variable               | Description                                              | Valeur par défaut              |
|------------------------|----------------------------------------------------------|--------------------------------|
| `APP_ENV`              | Environnement applicatif Symfony                         | `dev`                          |
| `JWT_SECRET`           | Secret JWT partagé (Auth Service + API Gateway)          | Généré par setup.sh            |
| `JWT_TTL`              | Durée de vie du token JWT (secondes)                     | `3600` (1 heure)               |
| `JWT_REFRESH_TTL`      | Durée de vie du refresh token (secondes)                 | `604800` (7 jours)             |
| `JWT_PASSPHRASE`       | Passphrase pour les clés RSA                             | Généré par setup.sh            |
| `AUTH_DB_*`            | Credentials PostgreSQL du auth-service                   | host, port, name, user, pass   |
| `USER_DB_*`            | Credentials PostgreSQL du user-service                   | host, port, name, user, pass   |
| `EVENT_DB_*`           | Credentials PostgreSQL du event-service                  | host, port, name, user, pass   |
| `TICKET_DB_*`          | Credentials PostgreSQL du ticket-service                 | host, port, name, user, pass   |
| `RABBITMQ_HOST`        | Hostname RabbitMQ (réseau Docker interne)                | `rabbitmq`                     |
| `RABBITMQ_USER`        | Utilisateur RabbitMQ                                     | `rabbit_user`                  |
| `RABBITMQ_PASSWORD`    | Mot de passe RabbitMQ                                    | Généré par setup.sh            |
| `RABBITMQ_URL`         | URL AMQP complète (calculée automatiquement)             | `amqp://user:pass@rabbitmq:5672/` |
| `AUTH_DATABASE_URL`    | URL Doctrine complète auth-service (calculée)            | `postgresql://...`             |
| `USER_DATABASE_URL`    | URL Doctrine complète user-service (calculée)            | `postgresql://...`             |
| `EVENT_DATABASE_URL`   | URL Doctrine complète event-service (calculée)           | `postgresql://...`             |
| `TICKET_DATABASE_URL`  | URL Prisma complète ticket-service (calculée)            | `postgresql://...`             |
| `AUTH_SERVICE_URL`     | URL interne auth-service (réseau Docker)                 | `http://auth-service:8001`     |
| `USER_SERVICE_URL`     | URL interne user-service (réseau Docker)                 | `http://user-service:8002`     |
| `EVENT_SERVICE_URL`    | URL interne event-service (réseau Docker)                | `http://event-service:8003`    |
| `TICKET_SERVICE_URL`   | URL interne ticket-service (réseau Docker)               | `http://ticket-service:8004`   |
| `API_GATEWAY_PORT`     | Port d'écoute de l'API Gateway                           | `8000`                         |
| `CORS_ALLOWED_ORIGINS` | Origines autorisées CORS                                 | `http://localhost,http://localhost:3000` |

> **Sécurité :** Le fichier `.env` est ignoré par Git. Ne jamais commiter de secrets.

---

## 9. Peupler la base de données (Seed)

Après le premier lancement, vous pouvez peupler automatiquement toutes les bases de données avec des données de démonstration :

```bash
node seed.js
# ou pour une URL personnalisée :
node seed.js --base-url http://localhost:8000/api
```

Le script crée en 4 étapes via l'API Gateway :

| Étape | Action | Résultat |
|-------|--------|---------|
| 1 | Inscription + login des utilisateurs | 1 admin, 2 organisateurs, 3 clients |
| 2 | Création des événements + options de billetterie | 7 événements (6 publiés, 1 brouillon) |
| 3 | Achat de billets | 10 achats croisés |
| 4 | Vérification finale | Affiche le bilan |

**Comptes créés par le seed :**

| Rôle | Email | Mot de passe |
|------|-------|-------------|
| Admin | admin.admin@ticketsaas.fr | Admin1234! |
| Organisateur | abdoulaye.orga@ticketsaas.fr | Orga1234! |
| Organisateur | ayman.prod@ticketsaas.fr | Orga1234! |
| Client | client1.client@mail.fr | User1234! |
| Client | client2.client@mail.fr | User1234! |
| Client | client3.client@mail.fr | User1234! |

> **Prérequis :** Les containers doivent être démarrés (`make up`) avant de lancer le seed.

---

## 10. Créer un compte administrateur

### Méthode 1 – Via l'API (recommandée)

Envoyer une requête `POST /api/auth/register` en passant `ROLE_ADMIN` dans le champ `roles` :

```bash
curl -s -X POST http://localhost/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@monsite.fr",
    "password": "AdminSecure1!",
    "roles": ["ROLE_ADMIN"]
  }' | python3 -m json.tool
```

Réponse attendue :

```json
{
  "message": "Inscription réussie.",
  "user": {
    "id": "...",
    "email": "admin@monsite.fr",
    "roles": ["ROLE_ADMIN"]
  }
}
```

> **Note sécurité :** Le champ `roles` est libre côté API. En production, il faudrait restreindre la création de `ROLE_ADMIN` à un endpoint dédié protégé ou le supprimer de l'API publique.

### Méthode 2 – Via la base de données (si le compte existe déjà)

Pour promouvoir un compte existant en admin, se connecter directement à la base `auth-db` :

```bash
# 1. Ouvrir un shell psql dans le container auth-db
docker compose exec auth-db psql -U ${AUTH_DB_USER} -d ${AUTH_DB_NAME}

# 2. Vérifier l'utilisateur cible
SELECT id, email, roles FROM "user" WHERE email = 'user@example.com';

# 3. Mettre à jour ses rôles
UPDATE "user"
SET roles = '["ROLE_ADMIN"]'
WHERE email = 'user@example.com';

# 4. Quitter psql
\q
```

### Méthode 3 – Via le script seed (données de démo)

Le script `node seed.js` crée automatiquement un compte admin de démonstration :

| Email | Mot de passe |
|-------|-------------|
| admin.admin@ticketsaas.fr | Admin1234! |

---

## 11. Commandes utiles

```bash
make help           # Afficher toutes les commandes disponibles
make up             # Démarrer tous les containers
make down           # Arrêter tous les containers
make restart        # Redémarrer tous les containers
make build          # Rebuild toutes les images Docker
make logs           # Voir les logs en temps réel
make ps             # État des containers (healthcheck)
make migrate        # Lancer toutes les migrations
make test           # Lancer tous les tests (PHPUnit + Jest)
make test-backend   # Tests PHPUnit uniquement (Symfony)
make test-node      # Tests Jest uniquement (Node.js)
make test-coverage  # Rapport de couverture HTML
make urls           # Afficher toutes les URLs des services
make clean          # Supprimer containers, volumes et images
make scale-events   # Lancer 3 instances event-service (test load balancer)
```

---

## 12. Auteurs

Abdoulaye FOFANA
Ayman EL KARROUSSI

