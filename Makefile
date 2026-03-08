#!/usr/bin/make

user_id := $(shell id -u)
docker_compose_bin := $(shell command -v docker-compose 2> /dev/null) --file "./docker-compose.yml"
node_container_bin := $(docker_compose_bin) run --rm -u "$(user_id)" "app"
npm_bin := $(node_container_bin) npm run

.DEFAULT_GOAL := build

# --- [ Development tasks ] -------------------------------------------------------------------------------------------

build: ## Build container and install npm libs
	$(docker_compose_bin) build --force-rm

up: ## Start containers
	$(docker_compose_bin) up -d --remove-orphans

down: ## Stop containers
	$(docker_compose_bin) down

restart: ## Stop containers
	$(docker_compose_bin) restart

logs: ## Stop containers
	$(docker_compose_bin) logs -f

install: up ## Install all data
	$(node_container_bin) npm install
	$(npm_bin) build

shell: up ## Runs shell in container
	$(node_container_bin) bash

start: install ## Start application
	$(npm_bin) start

watch: install ## Start application in watch mode
	$(npm_bin) watch