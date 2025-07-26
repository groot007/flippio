# Flippio Development Commands

.PHONY: test-rust test-frontend test-all lint typecheck precommit dev build help generate-test-dbs test-database verify-test-dbs test-performance clean-test dev-test

# Test commands
test-rust:
	@echo "🧪 Running Rust tests..."
	cd src-tauri && cargo test

test-frontend:
	@echo "🧪 Running frontend tests..."
	npm run test

# Generate test databases
generate-test-dbs:
	@echo "🚀 Generating test databases..."
	node scripts/generate-test-databases.js

# Run comprehensive database tests
test-database:
	@echo "🧪 Running database integration tests..."
	cd src-tauri && cargo test database_isolation -- --nocapture
	cd src-tauri && cargo test connection_pool -- --nocapture
	cd src-tauri && cargo test wal_file_recovery -- --nocapture

# Run all tests (frontend + backend)
test-all: generate-test-dbs
	@echo "🎯 Running comprehensive test suite..."
	npm test
	cd src-tauri && cargo test -- --nocapture

# Manual testing helper - verify test databases
verify-test-dbs:
	@echo "🔍 Verifying test databases..."
	@ls -la src-tauri/tests/fixtures/databases/ || echo "❌ Test databases not found. Run 'make generate-test-dbs' first."
	@sqlite3 src-tauri/tests/fixtures/databases/test_ecommerce.db "SELECT 'E-commerce Users:', COUNT(*) FROM users;"
	@sqlite3 src-tauri/tests/fixtures/databases/test_social.db "SELECT 'Social Profiles:', COUNT(*) FROM profiles;"
	@sqlite3 src-tauri/tests/fixtures/databases/test_notes.db "SELECT 'Note Folders:', COUNT(*) FROM folders;"

# Performance testing
test-performance:
	@echo "⚡ Running performance tests..."
	cd src-tauri && cargo test performance --release -- --nocapture

# Clean up test artifacts
clean-test:
	@echo "🧹 Cleaning up test artifacts..."
	rm -rf src-tauri/tests/fixtures/databases/
	rm -f *.db-wal *.db-shm
	@echo "✅ Test cleanup complete"

# Development workflow - full test cycle
dev-test: clean-test generate-test-dbs test-all
	@echo "🎉 Full development test cycle complete!"

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
	@echo ""
	@echo "Database Testing Commands:"
	@echo "  generate-test-dbs  - Generate test databases for testing"
	@echo "  test-database      - Run database integration tests"
	@echo "  verify-test-dbs    - Verify test databases are created correctly"
	@echo "  test-performance   - Run database performance tests"
	@echo "  clean-test         - Clean up test artifacts"
	@echo "  dev-test           - Complete development test cycle"
