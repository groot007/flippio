import Main from './pages/Main'
import { ColorModeProvider } from './ui/color-mode'
import { Provider } from './ui/provider'

function App(): JSX.Element {
  return (
    <Provider>
      <ColorModeProvider>
        <Main />
      </ColorModeProvider>
    </Provider>
  )
}

export default App
