# Flippio Refactoring Roadmap

## Phase 1: Foundation Setup (Week 1)

### 1.1 Create Feature-Based Structure
```bash
# Create the new folder structure
mkdir -p src/renderer/src/{features/{devices,database,change-history}/{components,hooks,services,stores},shared/{components,hooks,services,stores,types,utils},app/{layout,providers,router}}
```

### 1.2 Move Shared Utilities
- [ ] Move `utils/` → `shared/utils/`
- [ ] Move `types/global.d.ts` → `shared/types/`
- [ ] Move common UI components → `shared/components/ui/`
- [ ] Update all import paths

### 1.3 Enable TypeScript Strict Mode
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

## Phase 2: Service Layer Implementation (Week 2)

### 2.1 Create Service Abstractions
- [ ] `features/devices/services/deviceService.ts`
- [ ] `features/database/services/databaseService.ts`  
- [ ] `features/change-history/services/changeHistoryService.ts`
- [ ] `shared/services/apiClient.ts` (wrapper around window.api)

### 2.2 Standardize Error Handling
```typescript
interface ServiceResponse<T> {
  success: boolean
  data: T | null
  error: string | null
}
```

### 2.3 Add Input Validation
- [ ] Validate all service method parameters
- [ ] Add proper TypeScript types for all inputs/outputs
- [ ] Implement retry logic and timeout handling

## Phase 3: Hook Refactoring (Week 3)

### 3.1 Feature-Specific Hooks
- [ ] Move `useDevices` → `features/devices/hooks/`
- [ ] Move `useDatabaseTables` → `features/database/hooks/`
- [ ] Move `useChangeHistory` → `features/change-history/hooks/`

### 3.2 Extract Business Logic
- [ ] Create `useDeviceSelection` hook
- [ ] Create `useApplicationLifecycle` hook
- [ ] Create `useTableOperations` hook

### 3.3 Add Query Key Factories
```typescript
export const deviceQueryKeys = {
  all: ['devices'] as const,
  list: () => [...deviceQueryKeys.all, 'list'] as const,
  detail: (id: string) => [...deviceQueryKeys.all, 'detail', id] as const,
}
```

## Phase 4: Component Refactoring (Week 4)

### 4.1 Container/Presenter Pattern
- [ ] Split `AppHeader` into container + presenter
- [ ] Split `DataGrid` into container + presenter  
- [ ] Split `SidePanel` into container + presenter

### 4.2 Extract Reusable Components
- [ ] Create `shared/components/ui/Button.tsx`
- [ ] Create `shared/components/ui/Select.tsx`
- [ ] Create `shared/components/forms/FormField.tsx`

### 4.3 Add Performance Optimizations
```typescript
// Memoize expensive computations
const deviceOptions = useMemo(() => 
  devices.map(device => ({ value: device.id, label: device.name }))
, [devices])

// Memoize components
export const DeviceSelector = React.memo(({ devices, onSelect }) => {
  // Component implementation
})

// Memoize callbacks
const handleDeviceSelect = useCallback((device) => {
  onDeviceSelect(device)
}, [onDeviceSelect])
```

## Phase 5: State Management Cleanup (Week 5)

### 5.1 Organize Stores by Feature
- [ ] Move device stores → `features/devices/stores/`
- [ ] Move database stores → `features/database/stores/`
- [ ] Keep global stores in `shared/stores/`

### 5.2 Add Store Composition
```typescript
// Combine related stores
export const useDeviceState = () => ({
  ...useCurrentDeviceSelection(),
  ...useDeviceCapabilities(),
})
```

### 5.3 Implement Persistence Strategy
- [ ] Add selective state persistence
- [ ] Add state migration for breaking changes
- [ ] Add state validation on hydration

## Phase 6: Testing & Documentation (Week 6)

### 6.1 Update Tests
- [ ] Test service layers independently
- [ ] Test hooks with React Testing Library
- [ ] Add integration tests for critical paths

### 6.2 Add JSDoc Documentation
```typescript
/**
 * Retrieves all connected devices
 * @returns Promise with device list or error
 * @throws {ServiceError} When device detection fails
 */
async getDevices(): Promise<ServiceResponse<DeviceInfo[]>>
```

### 6.3 Performance Monitoring
- [ ] Add React DevTools Profiler integration
- [ ] Monitor bundle size changes
- [ ] Add performance budget alerts

## Quality Gates

### After Each Phase:
- [ ] All ESLint rules pass
- [ ] All TypeScript errors resolved  
- [ ] All tests passing
- [ ] No performance regressions
- [ ] Documentation updated

### Performance Targets:
- [ ] Initial load < 2s
- [ ] Device list refresh < 500ms
- [ ] Component re-renders minimized
- [ ] Bundle size increase < 10%

## Risk Mitigation

### Rollback Strategy:
- Keep old code commented until new code is tested
- Use feature flags for gradual rollout
- Maintain backward compatibility during transition

### Testing Strategy:
- Test each refactored module independently
- Run full regression suite after each phase
- Monitor production metrics during rollout
