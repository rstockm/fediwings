.DEFAULT_GOAL := check

.PHONY: check audit lint format format-check typecheck test test-browser build dev

check: lint format-check typecheck test build

audit:
	npm audit --audit-level=high

lint:
	npm run lint

format:
	npm run format

format-check:
	npm run format:check

typecheck:
	npm run typecheck

test:
	npm test

test-browser:
	npm run test:browser

build:
	npm run build

dev:
	npm run dev