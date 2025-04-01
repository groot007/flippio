import * as Sentry from '@sentry/electron/main'
import { dialog } from 'electron'
import { autoUpdater } from 'electron-updater'

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: 'Update downloaded. The application will now restart to apply the update.',
  }).then(() => {
    autoUpdater.quitAndInstall()
  })
})

autoUpdater.on('error', (err) => {
  console.error('Update error:', err)
  Sentry.captureException(err) // Capture update errors in Sentry
})

autoUpdater.on('update-available', (info) => {
  // Prevent autoUpdater from automatically downloading the update
  autoUpdater.autoDownload = false

  dialog.showMessageBox({
    type: 'info',
    title: 'Update Available',
    message: `A new version (${info.version}) is available.`,
    detail: 'Would you like to download and install it now?',
    buttons: ['Update Now', 'Later'],
    defaultId: 0,
    cancelId: 1,
  }).then(({ response }) => {
    if (response === 0) {
      // User chose to update
      dialog.showMessageBox({
        type: 'info',
        title: 'Downloading Update',
        message: 'The update is being downloaded and will be installed automatically.',
      })

      autoUpdater.downloadUpdate()
    }
    // If response === 1, user chose "Later", so we do nothing
  })
})
