import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import Main from './pages/Main'
import { Provider } from './ui/provider'
import { Toaster } from './ui/toaster'

// Register all Community features
ModuleRegistry.registerModules([AllCommunityModule])

function App(): JSX.Element {
  return (
    <Provider>
      <Main />
      <Toaster />
    </Provider>
  )
}

export default App
