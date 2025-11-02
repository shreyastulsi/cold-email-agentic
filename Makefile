.PHONY: up down logs migrate seed build clean

# Start all services
up:
	cd infra && docker-compose up -d

# Stop all services
down:
	cd infra && docker-compose down

# View logs
logs:
	cd infra && docker-compose logs -f

# Run database migrations
migrate:
	cd backend && alembic upgrade head

# Create new migration
migration:
	cd backend && alembic revision --autogenerate -m "$(name)"

# Seed database (if seed.py exists)
seed:
	cd backend && python -m app.db.seed

# Build all services
build:
	cd infra && docker-compose build

# Clean up volumes and containers
clean:
	cd infra && docker-compose down -v
	docker system prune -f

# Start development environment
dev: up
	@echo "Waiting for services to be ready..."
	sleep 5
	make migrate
	@echo "Development environment ready!"

