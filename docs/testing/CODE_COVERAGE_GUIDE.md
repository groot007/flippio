# Code Coverage Guide for Flippio Rust Backend

## Overview

This guide explains how to check code coverage for the Rust part of the Flippio application. Code coverage helps identify which parts of your code are tested and which areas need more test coverage.

## Quick Start

### Generate HTML Coverage Report
```bash
make coverage
# or
make coverage-html
```
This will:
- Run all tests with coverage instrumentation
- Generate an interactive HTML report
- Automatically open the report in your browser

### View Text Summary
```bash
make coverage-text
```
Shows a text-based coverage summary in the terminal.

## Coverage Tools Used

**Primary Tool: `cargo-llvm-cov`**
- Modern LLVM-based coverage tool for Rust
- Provides accurate line, function, and branch coverage
- Supports multiple output formats (HTML, LCOV, JSON, text)
- Integrates well with recent Rust toolchains

## Available Coverage Commands

### HTML Report (Interactive)
```bash
make coverage-html
```
- **Output**: `src-tauri/target/llvm-cov/html/index.html`
- **Features**: Interactive browsing, highlighted code, coverage percentages
- **Best for**: Detailed investigation and visual analysis

### Text Report (Terminal)
```bash
make coverage-text
```
- **Output**: Terminal display
- **Features**: Quick overview, percentage summaries
- **Best for**: CI/CD pipelines and quick checks

### LCOV Report (Industry Standard)
```bash
make coverage-lcov
```
- **Output**: `src-tauri/target/llvm-cov/lcov.info`
- **Features**: Compatible with many coverage tools and IDEs
- **Best for**: Integration with external tools (VS Code extensions, SonarQube)

### JSON Report (Machine Readable)
```bash
make coverage-json
```
- **Output**: `src-tauri/target/llvm-cov/coverage.json`
- **Features**: Structured data for automation
- **Best for**: Custom tooling and automated analysis

## Coverage Configuration

Configuration is stored in `src-tauri/.llvm-cov.toml`:

```toml
# Show lines with no coverage
show-missing-lines = true

# Coverage thresholds (percentages)
fail-under-lines = 60
fail-under-functions = 65

# Ignore test files and build artifacts
ignore-filename-regex = [
    ".*test.*",
    ".*/target/.*",
    ".*/build\\.rs",
]
```

### Adjusting Thresholds

To change coverage requirements:

1. **Edit `.llvm-cov.toml`**:
   ```toml
   fail-under-lines = 70      # Require 70% line coverage
   fail-under-functions = 75  # Require 75% function coverage
   ```

2. **Command-line override**:
   ```bash
   cd src-tauri && cargo llvm-cov --html --fail-under-lines 80
   ```

## Understanding Coverage Reports

### HTML Report Navigation

1. **Overview Page**: Shows overall coverage percentages
2. **File List**: Browse coverage by file/module
3. **Source View**: See exactly which lines are covered
4. **Color Coding**:
   - 🟢 **Green**: Covered lines
   - 🔴 **Red**: Uncovered lines
   - 🟡 **Yellow**: Partially covered (branches)

### Key Metrics

- **Line Coverage**: Percentage of executable lines that were run
- **Function Coverage**: Percentage of functions that were called
- **Region Coverage**: Percentage of code regions that were executed
- **Branch Coverage**: Percentage of conditional branches taken

### Reading Text Reports

```
Filename                      Regions    Missed Regions     Cover   Functions  Missed Functions  Executed       Lines      Missed Lines     Cover
/src/commands/database/commands.rs       1234         89    92.79%          45                3    93.33%         567               45    92.06%
```

- **Cover**: Coverage percentage for that metric
- **Missed**: Number of uncovered items
- **Executed**: Number of covered items

## Improving Coverage

### Identifying Low Coverage Areas

1. **Run HTML coverage**: `make coverage-html`
2. **Sort by coverage**: Click column headers in the report
3. **Focus on red files**: Files with <70% coverage
4. **Check function list**: Functions with 0% coverage

### Common Uncovered Code

**Error Handling Paths**:
```rust
// Often uncovered - add tests for error conditions
match some_operation() {
    Ok(result) => result,
    Err(e) => return Err(format!("Operation failed: {}", e)), // ← Uncovered
}
```

**Platform-Specific Code**:
```rust
#[cfg(target_os = "macos")]
fn macos_specific_function() {
    // May not be covered on all test environments
}
```

**Rarely Used Features**:
- Tool validation fallbacks
- Alternative code paths
- Debug-only functions

### Writing Tests for Coverage

**Test Error Conditions**:
```rust
#[tokio::test]
async fn test_database_connection_failure() {
    let manager = DatabaseConnectionManager::new();
    let result = manager.get_connection("/nonexistent/database.db").await;
    assert!(result.is_err());
}
```

**Test Edge Cases**:
```rust
#[tokio::test]
async fn test_empty_database_list() {
    let result = get_database_files(&empty_directory).await;
    assert_eq!(result.len(), 0);
}
```

## Integration with Development Workflow

### Pre-Commit Coverage Check
```bash
# Add to your development process
make coverage-text | grep "TOTAL" | grep -v "100.00%"
```

### CI/CD Integration
```yaml
# GitHub Actions example
- name: Check Coverage
  run: |
    cargo install cargo-llvm-cov
    cargo llvm-cov --lcov --output-path coverage.lcov
    # Upload to coverage service (Codecov, Coveralls, etc.)
```

### VS Code Integration

1. **Install Extension**: Coverage Gutters
2. **Generate LCOV**: `make coverage-lcov`
3. **Load Coverage**: `Ctrl+Shift+P` → "Coverage Gutters: Watch"

## Cleaning Up

```bash
# Remove coverage artifacts
make clean-coverage

# Remove all test artifacts (including coverage)
make clean-test
```

## Troubleshooting

### "llvm-tools-preview not found"
```bash
rustup component add llvm-tools-preview
```

### "Tests failing in coverage mode"
Some tests may behave differently with coverage instrumentation. Check:
- Timing-sensitive tests
- Tests that depend on specific build configurations
- Tests that read their own source code

### Low Coverage Numbers
- Ensure all test files are running: `cargo test`
- Check that coverage is measuring the right code paths
- Consider if 100% coverage is necessary for all files

## Best Practices

1. **Focus on Business Logic**: Prioritize coverage for core functionality
2. **Test Error Paths**: Don't just test the happy path
3. **Regular Checks**: Run coverage reports regularly, not just before releases
4. **Quality over Quantity**: 80% well-tested coverage is better than 95% shallow coverage
5. **Document Excluded Code**: Comment why certain code isn't tested

## Current Coverage Status

As of the latest test run, Flippio has:
- **Test Files**: 82 tests across unit and integration suites
- **Key Areas Covered**: Database operations, connection management, file utilities
- **Areas Needing Attention**: iOS tool validation, virtual device management, updater functionality

Run `make coverage` to see the current detailed coverage report. 