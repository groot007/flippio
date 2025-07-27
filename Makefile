# Makefile for Flippio project
# Updated Phony declaration
.PHONY: test-rust test-frontend test-all lint typecheck precommit dev build help generate-test-dbs test-database test-ios test-android test-cross-platform test-platforms quick-test-platforms verify-test-dbs test-performance clean-test dev-test test-real-commands coverage coverage-html coverage-text coverage-lcov coverage-json coverage-progress coverage-workflow clean-coverage

# Basic test targets
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

# Run real Tauri command integration tests
test-real-commands: verify-test-dbs
	@echo "🚀 Running real Tauri command integration tests..."
	cd src-tauri && cargo test database_isolation -- --nocapture

# Platform-specific tests
test-ios: verify-test-dbs
	@echo "🍎 Running iOS workflow tests..."
	cd src-tauri && cargo test ios_workflow -- --nocapture

test-android: verify-test-dbs
	@echo "🤖 Running Android workflow tests..."
	cd src-tauri && cargo test android_workflow -- --nocapture

test-cross-platform: verify-test-dbs
	@echo "🌐 Running cross-platform workflow tests..."
	cd src-tauri && cargo test cross_platform_workflow -- --nocapture

test-platforms: test-ios test-android test-cross-platform
	@echo "✅ All platform-specific tests completed"

# Run all tests (frontend + backend + real commands)
test-all: generate-test-dbs test-platforms test-real-commands
	@echo "🎯 Running comprehensive test suite..."
	npm test
	cd src-tauri && cargo test -- --nocapture

# Manual testing helper - verify test databases
verify-test-dbs:
	@echo "🔍 Verifying test databases..."
	@if [ -f "src-tauri/tests/fixtures/databases/test_ecommerce.db" ]; then \
		echo "✅ E-commerce database exists"; \
		echo "📊 Tables: `sqlite3 src-tauri/tests/fixtures/databases/test_ecommerce.db '.tables'`"; \
		echo "👥 Users: `sqlite3 src-tauri/tests/fixtures/databases/test_ecommerce.db 'SELECT COUNT(*) FROM users;'`"; \
	else \
		echo "❌ E-commerce database missing"; \
	fi
	@if [ -f "src-tauri/tests/fixtures/databases/test_social.db" ]; then \
		echo "✅ Social database exists"; \
		echo "📊 Tables: `sqlite3 src-tauri/tests/fixtures/databases/test_social.db '.tables'`"; \
		echo "👤 Profiles: `sqlite3 src-tauri/tests/fixtures/databases/test_social.db 'SELECT COUNT(*) FROM profiles;'`"; \
	else \
		echo "❌ Social database missing"; \
	fi
	@if [ -f "src-tauri/tests/fixtures/databases/test_notes.db" ]; then \
		echo "✅ Notes database exists"; \
		echo "📊 Tables: `sqlite3 src-tauri/tests/fixtures/databases/test_notes.db '.tables'`"; \
		echo "📝 Notes: `sqlite3 src-tauri/tests/fixtures/databases/test_notes.db 'SELECT COUNT(*) FROM notes;'`"; \
	else \
		echo "❌ Notes database missing"; \
	fi

# Performance testing
test-performance:
	@echo "⚡ Running performance tests..."
	cd src-tauri && cargo test performance --release -- --nocapture

# Clean up test artifacts
clean-test:
	@echo "🧹 Cleaning test artifacts..."
	rm -rf src-tauri/tests/fixtures/databases/*.db
	rm -rf src-tauri/tests/fixtures/databases/*.db-wal
	rm -rf src-tauri/tests/fixtures/databases/*.db-shm
	find /tmp -name "*flippio*test*.db*" -delete 2>/dev/null || true

# Development test cycle
dev-test: test-real-commands test-platforms
	@echo "🚀 Development test cycle completed"

# Quick platform test (without regenerating databases)
quick-test-platforms: verify-test-dbs
	@echo "⚡ Running all platform tests in parallel..."
	cd src-tauri && cargo test ios_workflow android_workflow cross_platform_workflow -- --nocapture
	@echo "⚡ Quick platform tests completed"

# Coverage targets
coverage: coverage-html
	@echo "📊 Code coverage analysis completed"

coverage-html: verify-test-dbs
	@echo "📊 Generating HTML coverage report..."
	cd src-tauri && cargo llvm-cov --html --open
	@echo "✅ HTML coverage report generated and opened in browser"
	@echo "📁 Report location: src-tauri/target/llvm-cov/html/index.html"

coverage-text: verify-test-dbs
	@echo "📊 Generating text coverage report..."
	cd src-tauri && cargo llvm-cov --text | tail -50

coverage-lcov: verify-test-dbs
	@echo "📊 Generating LCOV coverage report..."
	cd src-tauri && cargo llvm-cov --lcov --output-path target/llvm-cov/lcov.info
	@echo "✅ LCOV report generated: src-tauri/target/llvm-cov/lcov.info"

coverage-json: verify-test-dbs
	@echo "📊 Generating JSON coverage report..."
	cd src-tauri && cargo llvm-cov --json --output-path target/llvm-cov/coverage.json
	@echo "✅ JSON report generated: src-tauri/target/llvm-cov/coverage.json"

coverage-progress:
	@echo "🎯 Coverage Progress Tracking"
	@echo "=============================="
	@cd src-tauri && echo "📊 Current Coverage:" && cargo llvm-cov --text --quiet 2>/dev/null | tail -3 | head -1 || echo "Run 'make coverage-text' first"
	@echo ""
	@echo "📈 Test Count:"
	@cd src-tauri && cargo test 2>/dev/null | grep "test result:" | tail -1 || echo "Tests not run yet"
	@echo ""
	@echo "🎯 Target: 60%+ line coverage"
	@echo "📋 Strategy: docs/COVERAGE_IMPROVEMENT_STRATEGY.md"
	@echo ""

# Complete coverage workflow
coverage-workflow: verify-test-dbs coverage-text coverage-progress
	@echo "✅ Coverage analysis complete!"
	@echo "📖 View detailed strategy: docs/COVERAGE_IMPROVEMENT_STRATEGY.md"

clean-coverage:
	@echo "🧹 Cleaning coverage artifacts..."
	rm -rf src-tauri/target/llvm-cov/
	@echo "✅ Coverage artifacts cleaned"

# Linting and type checking
lint:
	@echo "🔍 Running frontend linter..."
	npm run lint

typecheck:
	@echo "📝 Running TypeScript type check..."
	npm run typecheck

# Pre-commit hook
precommit: lint typecheck test-all

# Development build
dev:
	@echo "🚀 Starting development build..."
	npm run tauri dev

# Production build
build:
	@echo "🏗️ Building production version..."
	npm run tauri build

# Help target
help:
	@echo "📖 Flippio Makefile Commands:"
	@echo ""
	@echo "🧪 Testing Commands:"
	@echo "  test-rust             - Run Rust backend tests"
	@echo "  test-frontend         - Run frontend tests"
	@echo "  test-all              - Run all tests (frontend + backend + platforms)"
	@echo ""
	@echo "🗃️ Database Testing:"
	@echo "  generate-test-dbs     - Generate test databases for testing"
	@echo "  test-database         - Run database integration tests"
	@echo "  test-real-commands    - Run real Tauri command integration tests"
	@echo "  verify-test-dbs       - Verify test databases are created correctly"
	@echo "  test-performance      - Run database performance tests"
	@echo "  clean-test            - Clean up test artifacts"
	@echo ""
	@echo "📱 Platform Testing:"
	@echo "  test-ios              - Run iOS workflow integration tests"
	@echo "  test-android          - Run Android workflow integration tests"
	@echo "  test-cross-platform   - Run cross-platform workflow tests"
	@echo "  test-platforms        - Run all platform-specific tests"
	@echo "  quick-test-platforms  - Quick platform tests (no db regeneration)"
	@echo ""
	@echo "📊 Coverage Analysis:"
	@echo "  coverage              - Generate HTML coverage report (default)"
	@echo "  coverage-html         - Generate interactive HTML coverage report"
	@echo "  coverage-text         - Display text coverage summary"
	@echo "  coverage-lcov         - Generate LCOV format report"
	@echo "  coverage-json         - Generate JSON format report"
	@echo "  coverage-progress     - Track current coverage progress"
	@echo "  coverage-workflow     - Run full coverage analysis workflow"
	@echo "  clean-coverage        - Clean up coverage artifacts"
	@echo ""
	@echo "🛠️ Development:"
	@echo "  dev-test              - Real commands + platform tests cycle"
	@echo "  lint                  - Run linting"
	@echo "  typecheck             - Run TypeScript type checking"
	@echo "  precommit             - Run all checks before commit"
	@echo "  dev                   - Start development server"
	@echo "  build                 - Build production version"
	@echo "  help                  - Show this help message"
