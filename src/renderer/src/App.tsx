import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { listen } from '@tauri-apps/api/event'

import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import { useEffect } from 'react'
import { useAutoUpdater } from './hooks/useAutoUpdater'
import Main from './pages/Main'
import { Provider } from './ui/provider'
import { Toaster, toaster } from './ui/toaster'

/* eslint-disable */
// @ts-expect-error include PostHog script 
!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init be ys Ss me gs ws capture Ne calculateEventProperties xs register register_once register_for_session unregister unregister_for_session Rs getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey canRenderSurveyAsync identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty Is ks createPersonProfile Ps bs opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing $s debug Es getPageViewId captureTraceFeedback captureTraceMetric".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

// Initialize PostHog if API key is available
const posthogApiKey = import.meta.env.VITE_POSTHOG_API_KEY
if (posthogApiKey && typeof window !== 'undefined' && (window as any).posthog) {
  console.log('Initializing PostHog with API key:', posthogApiKey);
  (window as any).posthog.init(posthogApiKey, {
      api_host: 'https://us.i.posthog.com',
      person_profiles: 'always', // or 'always' to create profiles for anonymous users as well
  })
}

/* eslint-enable */

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
  const { updateInfo, downloadAndInstall } = useAutoUpdater()

  useEffect(() => {
    // Wait for event system to be ready before setting up listeners
    const setupLogListener = async () => {
      try {
        const unlisten = await listen('tauri://log', (event) => {
          // event.payload contains the Rust log message
          console.log('[Rust Log]', JSON.stringify(event.payload))
          console.log('[Rust]', event.payload)
        })
        return unlisten
      }
      catch (error) {
        console.warn('Failed to setup log listener:', error)
        return null
      }
    }

    let unlistenPromise: Promise<(() => void) | null> | null = null

    // Small delay to ensure event system is initialized
    const timeoutId = setTimeout(() => {
      unlistenPromise = setupLogListener()
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      // Clean up the listener on unmount
      if (unlistenPromise) {
        unlistenPromise.then((fn) => {
          if (fn)
            fn()
        })
      }
    }
  }, [])

  // Show update notification when available
  useEffect(() => {
    if (updateInfo?.available && updateInfo.version) {
      toaster.create({
        title: 'Update Available',
        description: `Version ${updateInfo.version} is available. Click Update to install.`,
        type: 'info',
        duration: 15000, // 15 seconds
        action: {
          label: 'Update Now',
          onClick: downloadAndInstall,
        },
      })
    }
  }, [updateInfo, downloadAndInstall])

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
