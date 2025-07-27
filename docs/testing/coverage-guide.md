# Code Coverage Guide

## Overview

This document consolidates all code coverage strategies, improvements, and guidelines for the Flippio project. It provides comprehensive guidance on achieving and maintaining high test coverage.

## Current Coverage Status

### Backend (Rust) Coverage
- **Target**: >80% line coverage
- **Current Status**: Baseline established
- **Tools**: `cargo tarpaulin` for coverage reporting
- **CI Integration**: Automated coverage reports on PRs

### Frontend (TypeScript/React) Coverage
- **Target**: >75% line coverage  
- **Current Status**: Component tests in progress
- **Tools**: Vitest with coverage reporting
- **Components**: Focus on critical business logic

## Coverage Strategy

### 1. **High-Priority Coverage Areas**

#### Backend Critical Paths
- **Database Operations**: All CRUD operations and SQL query handling
- **Device Communication**: iOS and Android device interaction commands
- **File Transfer**: Database file pull/push operations
- **Error Handling**: All error scenarios and edge cases

#### Frontend Critical Paths
- **State Management**: Zustand store operations and state transitions
- **API Integration**: Tauri command invocations and error handling
- **Data Grid Operations**: Table data manipulation and display
- **User Workflows**: Complete user journey testing

### 2. **Coverage Improvement Strategy**

#### Phase 1: Foundation (Current)
```
✅ Database helper functions
✅ Device detection utilities  
✅ Basic command structure tests
⏳ Connection pool management
⏳ Error handling validation
```

#### Phase 2: Integration (Next)
```
🎯 End-to-end device workflows
🎯 Database operation sequences
🎯 Cross-platform compatibility
🎯 Performance testing
```

#### Phase 3: Advanced (Future)
```
🎯 Stress testing with large databases
🎯 Network failure simulation
🎯 Device disconnection scenarios
🎯 Concurrent operation testing
```

## Coverage Tools & Configuration

### Backend Coverage (Rust)

#### Installation
```bash
cargo install cargo-tarpaulin
```

#### Running Coverage
```bash
# Basic coverage report
cargo tarpaulin --out Html

# Coverage with exclusions
cargo tarpaulin --out Html --exclude-files "tests/*" "build.rs"

# CI-friendly format
cargo tarpaulin --out Xml --output-dir coverage/
```

#### Coverage Configuration (`Cargo.toml`)
```toml
[package.metadata.tarpaulin]
exclude = [
    "tests/*",
    "build.rs",
    "src/main.rs"
]
timeout = "120s"
fail-under = 80.0
```

### Frontend Coverage (Vitest)

#### Configuration (`vitest.config.ts`)
```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 70,
        statements: 75
      },
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.{ts,tsx}',
        '**/*.config.{ts,js}',
        'src/test-utils/**'
      ]
    }
  }
})
```

#### Running Frontend Coverage
```bash
# Generate coverage report
npm run test:coverage

# Watch mode with coverage
npm run test -- --coverage --watch
```

## Coverage Targets by Component

### Backend Components

| Component | Target | Priority | Status |
|-----------|--------|----------|---------|
| Database Commands | 90% | Critical | ✅ In Progress |
| Device Operations | 85% | Critical | ⏳ Planned |
| File Transfer | 85% | Critical | ⏳ Planned |
| Connection Pool | 95% | Critical | ✅ In Progress |
| Error Handling | 80% | High | ⏳ Planned |
| Utilities | 70% | Medium | ⏳ Planned |

### Frontend Components

| Component | Target | Priority | Status |
|-----------|--------|----------|---------|
| Store Logic | 85% | Critical | ⏳ Planned |
| API Layer | 90% | Critical | ⏳ Planned |
| Data Grid | 75% | High | ⏳ Planned |
| Side Panel | 75% | High | ⏳ Planned |
| Utilities | 70% | Medium | ⏳ Planned |
| UI Components | 60% | Low | ⏳ Future |

## Best Practices

### 1. **Test Organization**
- **Unit Tests**: Test individual functions in isolation
- **Integration Tests**: Test component interactions
- **E2E Tests**: Test complete user workflows
- **Mock Appropriately**: Mock external dependencies, not internal logic

### 2. **Coverage Quality Over Quantity**
- **Meaningful Tests**: Avoid tests that just increase coverage numbers
- **Edge Cases**: Test error conditions and boundary values
- **Business Logic**: Focus on critical application logic
- **User Scenarios**: Test real user workflows

### 3. **Continuous Improvement**
- **Regular Reviews**: Weekly coverage report reviews
- **Trend Monitoring**: Track coverage changes over time
- **Regression Prevention**: Maintain coverage on bug fixes
- **Team Education**: Share testing best practices

## Coverage Reporting

### Automated Reports

#### CI Pipeline Integration
```yaml
# GitHub Actions example
- name: Generate Coverage Report
  run: |
    cargo tarpaulin --out Xml --output-dir coverage/
    npm run test:coverage

- name: Upload Coverage to Codecov
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/cobertura.xml,./coverage/lcov.info
```

#### Local Development
```bash
# Generate and view coverage
make coverage        # Run both backend and frontend coverage
make coverage-view   # Open HTML reports in browser
```

### Coverage Metrics

#### Key Metrics to Track
- **Line Coverage**: Percentage of lines executed
- **Branch Coverage**: Percentage of conditional branches tested
- **Function Coverage**: Percentage of functions called
- **Statement Coverage**: Percentage of statements executed

#### Coverage Thresholds
```
Critical Components: >85%
High Priority: >80%
Medium Priority: >70%
Low Priority: >60%
```

## Common Coverage Challenges

### 1. **Device-Dependent Code**
**Challenge**: Testing code that requires physical devices
**Solution**: 
- Mock device communication layers
- Use test fixtures for device responses
- Simulate device states in tests

### 2. **File System Operations**
**Challenge**: Testing file operations safely
**Solution**:
- Use temporary directories for tests
- Mock file system calls where appropriate
- Clean up test artifacts automatically

### 3. **Async Operations**
**Challenge**: Testing async/await code properly
**Solution**:
- Use proper async test utilities
- Test both success and failure scenarios
- Handle timeouts appropriately

### 4. **External Dependencies**
**Challenge**: Testing code with external tool dependencies
**Solution**:
- Mock external tool calls
- Use test doubles for command execution
- Validate inputs/outputs rather than implementation

## Coverage Enhancement Checklist

### Before Writing Tests
- [ ] Identify critical code paths
- [ ] Define test scenarios (happy path, edge cases, errors)
- [ ] Set up appropriate test fixtures
- [ ] Plan mock strategy for dependencies

### During Test Development
- [ ] Write tests for both success and failure cases
- [ ] Test boundary conditions and edge cases
- [ ] Ensure tests are deterministic and repeatable
- [ ] Add descriptive test names and documentation

### After Test Implementation
- [ ] Run coverage reports to verify improvements
- [ ] Review uncovered lines for necessity
- [ ] Update documentation if needed
- [ ] Add tests to CI pipeline

## Resources

### Documentation
- [Comprehensive Testing Plan](comprehensive-testing-plan.md)
- [Testing Execution Guide](execution-guide.md)
- [Project Overview - Testing Section](../PROJECT_OVERVIEW.md#testing-strategy)

### Tools
- **Rust**: [cargo-tarpaulin](https://github.com/xd009642/tarpaulin)
- **TypeScript**: [Vitest Coverage](https://vitest.dev/guide/coverage.html)
- **CI**: [Codecov](https://codecov.io/) for coverage tracking

---

*This guide is regularly updated to reflect current best practices and project needs.* 