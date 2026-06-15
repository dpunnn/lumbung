.PHONY: up down logs build infra-up infra-down

up:
	docker compose -f deploy/docker-compose.yml up -d --build

down:
	docker compose -f deploy/docker-compose.yml down

logs:
	docker compose -f deploy/docker-compose.yml logs -f

build:
	docker compose -f deploy/docker-compose.yml build

infra-up:
	docker compose -f deploy/docker-compose.yml up -d postgres rabbitmq redis minio

infra-down:
	docker compose -f deploy/docker-compose.yml stop postgres rabbitmq redis minio
