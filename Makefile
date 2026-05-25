#!/usr/bin/make

user_id := $(shell id -u)
docker_compose_bin := $(shell command -v docker-compose 2> /dev/null)
node_container_bin := $(docker_compose_bin) run --rm -u "$(user_id)" "app"
npm_bin := $(node_container_bin) npm run

.DEFAULT_GOAL := build

# --- [ Development tasks ] -------------------------------------------------------------------------------------------

docker-build: ## Build docker container
	$(docker_compose_bin) build --force-rm

shell: ## Runs shell in container
	$(node_container_bin) /bin/bash

install: ## Install all data
	$(node_container_bin) npm install

build: ## Build TS files of the application
	$(npm_bin) build

start: ## Start application
	$(npm_bin) start

watch: install ## Start application in watch mode
	$(npm_bin) watch

linter: ## Lint code
	$(npm_bin) lint

fixer: ## Format code with Prettier
	$(npm_bin) format:fixAll

test: ## Run tests
	$(npm_bin) test

test-coverage: ## Run tests with coverage
	$(npm_bin) test:coverage

test-watch: ## Run tests in watch mode
	$(npm_bin) test:watch

validate-change: ## Run validation checks
	$(npm_bin) validate:change