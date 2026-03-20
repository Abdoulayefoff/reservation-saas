.PHONY: up down logs test ps clean migrate build help

GREEN  := \033[0;32m
YELLOW := \033[0;33m
RED    := \033[0;31m
NC     := \033[0m

help: ## Affiche cette aide
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*?##/ { printf "  $(YELLOW)               $(NC) \n", $$1, $$2 }' $(MAKEFILE_LIST)

up: ## Lance tous les containers
	docker compose up --build -d

down: ## Arrête et supprime les containers
	docker compose down

build: ## Construit toutes les images Docker
	docker compose build

logs: ## Affiche les logs en temps réel
	docker compose logs -f --tail=100

ps: ## Affiche l'état de tous les containers
	docker compose ps

test: ## Lance tous les tests
	@echo "$(GREEN)── Auth Service (PHPUnit) ──$(NC)"
	docker compose exec auth-service php bin/phpunit --testdox
	@echo "$(GREEN)── User Service (PHPUnit) ──$(NC)"
	docker compose exec user-service php bin/phpunit --testdox
	@echo "$(GREEN)── Event Service (PHPUnit) ──$(NC)"
	docker compose exec event-service php bin/phpunit --testdox
	@echo "$(GREEN)── Ticket Service (Jest) ──$(NC)"
	docker compose exec ticket-service npm test
	@echo "$(GREEN)── API Gateway (Jest) ──$(NC)"
	docker compose exec api-gateway npm test
	@echo "$(GREEN)── Notification Service (Jest) ──$(NC)"
	docker compose exec notification-service npm test

migrate: ## Execute les migrations sur tous les services
	docker compose exec auth-service php bin/console doctrine:migrations:migrate --no-interaction
	docker compose exec user-service php bin/console doctrine:migrations:migrate --no-interaction
	docker compose exec event-service php bin/console doctrine:migrations:migrate --no-interaction
	docker compose exec ticket-service npx prisma migrate deploy

clean: ## Supprime containers volumes et images
	docker compose down -v --rmi local
