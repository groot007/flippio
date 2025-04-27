import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import Main from './pages/Main'
import { Provider } from './ui/provider'
import { Toaster } from './ui/toaster'

// Register all Community features
ModuleRegistry.registerModules([AllCommunityModule])

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Disable auto refetch on window focus
    },
  },
})

function App(): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <Provider>
        <Main />
        <Toaster />
      </Provider>
    </QueryClientProvider>
  )
}

export default App
