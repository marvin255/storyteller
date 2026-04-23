# AGENTS

## Project Technologies

This project uses the following technologies:

- **Node.js 24** as the runtime environment.
- **TypeScript** for development and type safety.
- **Jest** for unit testing.


## Dev environment tips

- All development lifecycle commands must be run inside the Docker container.
    - Docker Compose is located at `./docker-compose.yml`
    - The PHP container is named `app`
    - All important commands are defined in package.json, so use the following pattern to run them: `docker-compose run --rm -u "$(user_id)" "app" npm run {{command}}`
    - Aliases for all commands are also defined in the `Makefile`.
    - Using `make` is always preferable when it is installed in the current environment.
- Commands
    - Install all dependencies
        - Docker: `docker-compose run --rm -u "$(user_id)" "app" npm install`
        - Make: `make install`
    - Build application including ts
        - Docker: `docker-compose run --rm -u "$(user_id)" "app" npm run build`
        - Make: `make build`
    - Fix files so they follow the code style
        - Docker: `docker-compose run --rm -u "$(user_id)" "app" npm run format`
        - Make: `make fixer`
    - Run the linter (static analysis and code style checks)
        - Docker: `docker-compose run --rm -u "$(user_id)" "app" npm run lint`
        - Make: `make linter`
    - Run all tests
        - Docker: `docker-compose run --rm -u "$(user_id)" "app" npm run test`
        - Make: `make test`
    - Run all tests with code coverage
        - Docker: `docker-compose run --rm -u "$(user_id)" "app" npm run test:coverage`
        - Make: `make test-coverage`
    - Run all validations required to verify a single change
        - Docker: `docker-compose run --rm -u "$(user_id)" "app" npm run validate:change`
        - Make: `make validate-change`
    - Start a Bash session in the container environment
        - Docker: `docker-compose run --rm -u "$(user_id)" "app" /bin/bash`
        - Make: `make shell`

## Development workflow

- Make the change.
- Add one or more tests for the change, and update existing tests as needed. All changes must be covered by unit tests.
- To verify that the change is correct, run the following steps in order. If any step fails, stop and fix the issue before continuing:
    - Prefer running `make validate-change` to perform all checks in a single command.
    - Alternatively, run each check separately:
        - Format the files to match the code style.
        - Run the linter.
        - Run all tests.
- After making the change, update `./README.md` and any other relevant documentation as needed.