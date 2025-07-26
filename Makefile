# Flippio Development Commands

.PHONY: test test-rust test-frontend test-all lint typecheck dev build

# Test commands
test-rust:
	@echo "🧪 Running Rust tests..."
	cd src-tauri && cargo test

test-frontend:
	@echo "🧪 Running frontend tests..."
	npm run test

test-all: test-rust test-frontend
	@echo "✅ All tests completed!"

# Quality checks
lint:
	@echo "🔍 Running linter..."
	npm run lint

typecheck:
	@echo "🔍 Running TypeScript checks..."
	npm run typecheck

# Combined pre-commit checks
precommit: lint typecheck test-all
	@echo "✅ All pre-commit checks passed!"

# Development
dev:
	@echo "🚀 Starting development server..."
	npm run tauri:dev

# Build
build:
	@echo "🏗️  Building application..."
	npm run tauri:build

# Help
help:
	@echo "Available commands:"
	@echo "  test-rust     - Run Rust backend tests"
	@echo "  test-frontend - Run frontend tests"
	@echo "  test-all      - Run all tests"
	@echo "  lint          - Run linter"
	@echo "  typecheck     - Run TypeScript checks"
	@echo "  precommit     - Run all quality checks"
	@echo "  dev           - Start development server"
	@echo "  build         - Build application"
