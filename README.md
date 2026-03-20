# reservation-saas

Système SaaS de réservation de concerts et billets d'événements.
Architecture microservices entièrement dockerisée.

## Prérequis

- Docker Desktop 24+
- Docker Compose v2
- Git

## Lancement
```bash
chmod +x setup.sh && ./setup.sh
```

## Technologies

| Service | Stack | Port |
|---|---|---|
| Nginx | nginx:alpine | 80 |
| API Gateway | Node.js / Express | 8000 |
| Auth Service | Symfony 7 / PHP 8.3 | 8001 |
| User Service | Symfony 7 / PHP 8.3 | 8002 |
| Event Service | Symfony 7 / PHP 8.3 | 8003 |
| Ticket Service | Node.js / Express | 8004 |
| Notification Service | Node.js / Express | 8005 |
| RabbitMQ | rabbitmq:3-management | 5672 |
| PostgreSQL (x4) | postgres:16 | 5432-5435 |
| Frontend | React 18 + TypeScript | 3000 |