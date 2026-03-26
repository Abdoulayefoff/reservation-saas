.PHONY: help up down restart build logs ps \
        setup migrate \
        test test-backend test-node test-coverage \
        shell-auth shell-user shell-event shell-ticket shell-gateway shell-frontend \
        clean clean-volumes scale-events urls

GREEN  := \033[0;32m
YELLOW := \033[1;33m
BLUE   := \033[0;34m
NC     := \033[0m

help: ## Affiche cette aide
	@echo ""
	@echo "  $(BLUE)SaaS Réservation – Commandes disponibles$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""

# DOCKER
up: ## Démarrer tous les containers
	docker compose up -d

down: ## Arrêter tous les containers
	docker compose down

restart: ## Redémarrer tous les containers
	docker compose down && docker compose up -d

build: ## Rebuild toutes les images Docker
	docker compose build

logs: ## Voir les logs en temps réel
	docker compose logs -f --tail=100

ps: ## État des containers
	docker compose ps

# SETUP
setup: ## Installation complète (première fois)
	chmod +x setup.sh && ./setup.sh

# TESTS

test: test-backend test-node ## Lancer tous les tests

test-backend: ## Tests PHPUnit (auth + user + event services)
	@echo "$(GREEN)── Auth Service (PHPUnit) ──$(NC)"
	docker compose exec auth-service php bin/phpunit --testdox
	@echo "$(GREEN)── User Service (PHPUnit) ──$(NC)"
	docker compose exec user-service php bin/phpunit --testdox
	@echo "$(GREEN)── Event Service (PHPUnit) ──$(NC)"
	docker compose exec event-service php bin/phpunit --testdox

test-node: ## Tests Jest (api-gateway + ticket-service + notification-service)
	@echo "$(GREEN)── API Gateway (Jest) ──$(NC)"
	docker compose exec -T api-gateway npm test -- --coverage
	@echo "$(GREEN)── Ticket Service (Jest) ──$(NC)"
	docker compose exec -T ticket-service-1 npm test -- --coverage
	@echo "$(GREEN)── Notification Service (Jest) ──$(NC)"
	docker compose exec -T notification-service npm test -- --coverage

test-coverage: ## Rapports de couverture HTML (services PHP)
	docker compose exec -T auth-service php bin/phpunit --coverage-html build/coverage
	docker compose exec -T user-service php bin/phpunit --coverage-html build/coverage
	docker compose exec -T event-service php bin/phpunit --coverage-html build/coverage

# MIGRATIONS

migrate: ## Lancer toutes les migrations
	docker compose exec -T auth-service php bin/console doctrine:migrations:migrate --no-interaction
	docker compose exec -T user-service php bin/console doctrine:migrations:migrate --no-interaction
	docker compose exec -T event-service php bin/console doctrine:migrations:migrate --no-interaction
	docker compose exec -T ticket-service-1 npx prisma db push --accept-data-loss

# SHELLS

shell-auth: ## Shell dans auth-service
	docker compose exec auth-service bash

shell-user: ## Shell dans user-service
	docker compose exec user-service bash

shell-event: ## Shell dans event-service
	docker compose exec event-service bash

shell-ticket: ## Shell dans ticket-service
	docker compose exec ticket-service-1 sh

shell-gateway: ## Shell dans api-gateway
	docker compose exec api-gateway sh

shell-frontend: ## Shell dans frontend
	docker compose exec frontend sh

# NETTOYAGE

clean: ## Supprimer containers, volumes et images
	docker compose down -v --rmi local

clean-volumes: ## Supprimer uniquement les volumes (reset BDD)
	docker compose down -v

# SCALABILITÉ (Load Balancer NGINX)

scale-events: ## Lancer 3 instances event-service (test least_conn)
	docker compose up -d --scale event-service=3

# INFOS

urls: ## Afficher toutes les URLs des services
	@echo ""
	@echo "  Application       : http://localhost"
	@echo "  API Gateway       : http://localhost:8000"
	@echo "  Auth Service      : http://localhost:8001"
	@echo "  User Service      : http://localhost:8002"
	@echo "  Event Service     : http://localhost:8003"
	@echo "  Ticket Service    : http://localhost:8004"
	@echo "  Notification      : http://localhost:8005"
	@echo "  Frontend (direct) : http://localhost:3000"
	@echo "  RabbitMQ UI       : http://localhost:15672"
	@echo ""
	@echo "  Swagger Auth      : http://localhost:8001/api/doc"
	@echo "  Swagger User      : http://localhost:8002/api/doc"
	@echo "  Swagger Event     : http://localhost:8003/api/doc"
	@echo "  Swagger Ticket    : http://localhost:8004/api-docs"
	@echo ""
