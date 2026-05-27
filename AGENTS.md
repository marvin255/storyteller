# AGENTS

## Stack

- Node.js 24
- TypeScript
- Jest
- ESLint and Prettier

## Project structure

- Source code lives in `src/`.
- Unit tests live in `tests/`.
- Compiled output is written to `dist/`.

## Command policy

- Run all development lifecycle commands inside the Docker container.
- Docker Compose is configured in `./docker-compose.yml`.
- The application service is named `app`.
- Prefer `make` targets when they are available.
- Use raw `docker-compose` commands only when `make` is unavailable or a needed task is not exposed by the `Makefile`.
- Raw Docker commands should use this pattern:
  `docker-compose run --rm -u "$(user_id)" "app" npm run {{command}}`

## Common commands

Use these `make` targets for routine work:

| Task | Command |
| --- | --- |
| Install dependencies | `make install` |
| Install a package | `make install-package LIBRARY={{LIBRARY}}` |
| Install a dev package | `make install-package-dev LIBRARY={{LIBRARY}}` |
| Remove a package | `make remove-package LIBRARY={{LIBRARY}}` |
| Build the TypeScript application | `make build` |
| Fix formatting and lint issues | `make fixer` |
| Run static analysis and style checks | `make linter` |
| Run all tests | `make test` |
| Run all tests with coverage | `make test-coverage` |
| Run all validation checks | `make verify` |
| Start a shell in the container | `make shell` |

## Development workflow

- Keep changes focused on the requested task.
- Follow existing project patterns before introducing new abstractions.
- Add or update Jest tests for behavior changes. Production code changes should be covered by unit tests.
- Avoid adding dependencies unless they are clearly justified.
- If dependencies change, use the package-management commands above and keep the lockfile in sync.
- Update `README.md` or other relevant documentation when setup, commands, behavior, or public usage changes.

## Verification

- Prefer running `make verify` to perform all checks in one command.
- If checking separately, run the steps in this order:
  1. `make fixer`
  2. `make linter`
  3. `make test`
- If any verification step fails, stop and fix the issue before continuing.
- `make fixer` can modify files; inspect the diff afterward before finalizing changes.

## Git and workspace guardrails

- Do not revert or overwrite unrelated user changes.
- Check the existing diff before making broad edits.
- Keep unrelated refactors out of task-focused changes.
- Mention any verification command that was not run.
