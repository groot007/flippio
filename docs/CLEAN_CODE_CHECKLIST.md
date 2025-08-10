# Senior Developer Code Quality Checklist

## 🏗️ Architecture & Design

### ✅ File Organization
- [ ] Features organized by domain, not by type
- [ ] Clear separation between app/, features/, and shared/
- [ ] Each feature is self-contained and independently testable
- [ ] Consistent naming conventions across all files

### ✅ Component Design
- [ ] Single Responsibility Principle followed
- [ ] Container/Presenter pattern for complex components
- [ ] Props interfaces clearly defined with JSDoc
- [ ] Component composition over inheritance

### ✅ Service Layer
- [ ] All Tauri API calls wrapped in service classes
- [ ] Consistent error handling and response format
- [ ] Input validation on all service methods
- [ ] Proper TypeScript types for all parameters and returns

## 🔒 TypeScript & Type Safety

### ✅ Strict Mode
- [ ] `strict: true` enabled in tsconfig.json
- [ ] No `any` types (use `unknown` when needed)
- [ ] All function parameters and returns typed
- [ ] Proper generic constraints where applicable

### ✅ Interface Design
- [ ] Interfaces over type aliases for object shapes
- [ ] Consistent naming (PascalCase with descriptive suffixes)
- [ ] Optional vs required properties clearly defined
- [ ] Avoid deep nesting (max 3 levels)

## 🎣 Hooks & State Management

### ✅ Custom Hooks
- [ ] Business logic extracted into custom hooks
- [ ] Hooks follow single responsibility principle
- [ ] Proper dependency arrays in useEffect/useCallback
- [ ] Query key factories for React Query

### ✅ State Management
- [ ] Global state minimized (prefer local state)
- [ ] Zustand stores organized by feature
- [ ] Immutable state updates
- [ ] Proper state persistence strategy

## ⚡ Performance

### ✅ React Optimizations
- [ ] React.memo for expensive pure components
- [ ] useCallback for event handlers passed as props
- [ ] useMemo for expensive computations
- [ ] Avoid creating objects/functions in render

### ✅ Bundle Optimization
- [ ] Lazy loading for large components
- [ ] Tree-shaking friendly exports
- [ ] Minimize re-renders with proper dependencies
- [ ] Code splitting at feature boundaries

## 🧪 Testing & Quality

### ✅ Test Coverage
- [ ] Service layer unit tests (>90% coverage)
- [ ] Hook tests with React Testing Library
- [ ] Integration tests for critical user flows
- [ ] Error boundary tests

### ✅ Error Handling
- [ ] Graceful error handling in all async operations
- [ ] User-friendly error messages
- [ ] Error boundaries for component failures
- [ ] Proper logging for debugging

## 📚 Documentation & Maintainability

### ✅ Code Documentation
- [ ] JSDoc comments for all public APIs
- [ ] Complex business logic explained
- [ ] README files for each feature
- [ ] Architecture decisions documented

### ✅ Code Style
- [ ] ESLint rules consistently applied
- [ ] Prettier formatting
- [ ] Consistent import organization
- [ ] Meaningful variable and function names

## 🔄 DRY & Reusability

### ✅ Code Duplication
- [ ] Common logic extracted into shared utilities
- [ ] Reusable UI components in shared/components
- [ ] Common patterns abstracted into hooks
- [ ] Configuration values centralized

### ✅ Abstraction Levels
- [ ] Appropriate abstraction (not over-engineered)
- [ ] Clear separation of concerns
- [ ] Dependency injection where beneficial
- [ ] Interface segregation principle followed

## Daily Development Checklist

### Before Committing:
- [ ] Run `npm run lint` - no errors
- [ ] Run `npm run test` - all tests pass
- [ ] Run `npm run build` - builds successfully
- [ ] Check bundle size impact
- [ ] Review code for performance implications

### Code Review Checklist:
- [ ] Business logic is testable and tested
- [ ] Error cases are handled appropriately
- [ ] Performance implications considered
- [ ] Security implications reviewed
- [ ] Accessibility requirements met

### New Feature Checklist:
- [ ] Feature organized in appropriate folder structure
- [ ] Service layer abstracts all external calls
- [ ] Custom hooks encapsulate business logic  
- [ ] Components follow container/presenter pattern
- [ ] Comprehensive tests cover happy and error paths
- [ ] Documentation explains the feature's purpose and usage

## Red Flags to Avoid

### 🚫 Anti-Patterns
- [ ] No business logic in components
- [ ] No direct window.api calls in components
- [ ] No useState for server state (use React Query)
- [ ] No props drilling (use proper state management)
- [ ] No massive components (>200 lines)

### 🚫 Performance Killers
- [ ] No creating functions/objects in render
- [ ] No missing dependency arrays
- [ ] No unnecessary re-renders
- [ ] No blocking the main thread
- [ ] No memory leaks from uncleaned effects

This checklist ensures your Flippio codebase maintains senior developer standards consistently across all development work.
