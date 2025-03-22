import Main from './pages/Main'
import { Provider } from './ui/provider'

function App(): JSX.Element {
  return (
    <Provider>
      <Main />
    </Provider>
  )
}

export default App
