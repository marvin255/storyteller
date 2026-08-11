#!/usr/bin/make

user_id := $(shell id -u)
docker_compose_bin := docker compose
node_container_bin := $(docker_compose_bin) exec -u "$(user_id)" "app"
npm_bin := $(node_container_bin) npm run

.DEFAULT_GOAL := build

# --- [ Development tasks ] -------------------------------------------------------------------------------------------

docker-build: ## Build docker container
	$(docker_compose_bin) build --force-rm

docker-up: ## Start containers
	$(docker_compose_bin) up -d --remove-orphans

docker-down: ## Stop containers
	$(docker_compose_bin) down

docker-restart: ## Stop containers
	$(docker_compose_bin) restart

docker-logs: ## Stop containers
	$(docker_compose_bin) logs -f

shell: ## Runs shell in container
	$(node_container_bin) /bin/bash

install: ## Install all data
	$(node_container_bin) npm install

install-package: ## Install a single npm package (usage: make install-package LIBRARY=package-name)
	$(node_container_bin) npm install $(LIBRARY)

install-package-dev: ## Install a single npm package as dev dependency (usage: make install-package-dev LIBRARY=package-name)
	$(node_container_bin) npm install -D $(LIBRARY)

remove-package: ## Remove a single npm package (usage: make remove-package LIBRARY=package-name)
	$(node_container_bin) npm uninstall $(LIBRARY)

build: ## Build TS files of the application
	$(npm_bin) build

start: ## Start application
	$(npm_bin) start

watch: install ## Start application in watch mode
	$(npm_bin) watch

linter: ## Lint code
	$(npm_bin) linter

architecture: ## Check architecture dependency boundaries
	$(npm_bin) architecture

fixer: ## Format code with Prettier
	$(npm_bin) fixer

test: ## Run tests
	$(npm_bin) test

test-coverage: ## Run tests with coverage
	$(npm_bin) test:coverage

test-mutation: ## Run mutation tests
	$(npm_bin) test:mutation

test-mutation-dry: ## Validate mutation testing setup without running mutants
	$(npm_bin) test:mutation:dry

test-watch: ## Run tests in watch mode
	$(npm_bin) test:watch

verify: ## Run validation checks
	$(npm_bin) verify
