.DEFAULT_GOAL := check

.PHONY: check audit lint format format-check typecheck test test-browser build dev sbom sbom-check

check: lint format-check typecheck test build sbom-check

sbom:
	npm run sbom

sbom-check:
	npm run sbom:check

audit:
	npm run audit

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
	npm run test:sbom
	npm run test:audit

test-browser:
	npm run test:browser

build:
	npm run build

dev:
	npm run dev
