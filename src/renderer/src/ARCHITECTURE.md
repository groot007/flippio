# Flippio Architecture - Feature-Based Structure

## 🏗️ Improved Folder Structure

```
src/renderer/src/
├── app/                          # Application-level components and configuration
│   ├── layout/                   # Main layout components (Header, Shell)
│   ├── providers/                # Root providers (QueryClient, Theme, etc.)
│   └── router/                   # Application routing configuration
├── features/                     # Feature-based modules (Domain-driven design)
│   ├── devices/                  # Device management feature
│   │   ├── components/           # Device-specific UI components
│   │   ├── hooks/                # Device-related custom hooks
│   │   ├── services/             # Device API service layer
│   │   ├── stores/               # Device state management
│   │   └── types.ts              # Device-specific types
│   ├── database/                 # Database operations feature
│   │   ├── components/           # DataGrid, TableSelector, etc.
│   │   ├── hooks/                # Database query hooks
│   │   ├── services/             # Database API service layer
│   │   ├── stores/               # Database state management
│   │   └── types.ts              # Database-specific types
│   └── change-history/           # Change tracking feature
│       ├── components/           # Change history UI components
│       ├── hooks/                # Change history hooks
│       ├── services/             # Change history API layer
│       └── types.ts              # Change history types
├── shared/                       # Shared/common code across features
│   ├── components/               # Reusable UI components
│   │   ├── ui/                   # Basic UI primitives (Button, Modal, etc.)
│   │   ├── forms/                # Form components
│   │   └── layout/               # Layout components
│   ├── hooks/                    # Shared custom hooks
│   ├── services/                 # Shared services (API client, utils)
│   ├── stores/                   # Global application state
│   ├── types/                    # Shared TypeScript types
│   └── utils/                    # Utility functions
├── assets/                       # Static assets (images, styles, fonts)
├── App.tsx                       # Root application component
└── main.tsx                      # Application entry point
```

## 🎯 Architecture Principles

### 1. Feature-Based Organization
- Each feature is self-contained with its own components, hooks, services, and types
- Features can be developed independently and are easy to test
- Clear boundaries between different domains of the application

### 2. Layered Architecture
- **Presentation Layer**: React components and hooks
- **Service Layer**: API interactions and business logic
- **State Layer**: Zustand stores for state management
- **Data Layer**: Tauri backend integration

### 3. Dependency Flow
```
Components → Hooks → Services → Tauri API
     ↓
   Stores (for state management)
```

### 4. Naming Conventions
- **Components**: PascalCase (e.g., `DeviceSelector`)
- **Hooks**: camelCase with `use` prefix (e.g., `useDeviceSelection`)
- **Services**: camelCase with descriptive names (e.g., `deviceService`)
- **Types**: PascalCase with descriptive suffixes (e.g., `DeviceInfo`, `DatabaseTable`)

### 5. Import Organization
```typescript
// 1. External libraries
import { useState, useCallback } from 'react'
import { Button, VStack } from '@chakra-ui/react'

// 2. Internal shared modules
import { useToast } from '@/shared/hooks'
import { ErrorBoundary } from '@/shared/components'

// 3. Feature-specific modules
import { useDeviceSelection } from '../hooks'
import { deviceService } from '../services'

// 4. Types (always last)
import type { Device } from '../types'
```

## 🔧 Key Improvements

1. **Clear Separation of Concerns**: Each layer has a specific responsibility
2. **Better Testability**: Services and hooks can be tested independently
3. **Improved Maintainability**: Related code is co-located
4. **Enhanced Reusability**: Shared components and utilities are centralized
5. **Type Safety**: Strong TypeScript integration throughout
