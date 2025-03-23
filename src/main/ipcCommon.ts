import { dialog, ipcMain } from 'electron'

export function setupIpcCommon() {
  ipcMain.handle('dialog:selectFile', async (_event, options) => {
    const result = await dialog.showOpenDialog(options)
    return result
  })

  ipcMain.handle('dialog:saveFile', async (_event, options) => {
    const result = await dialog.showSaveDialog(options)
    return result
  })
}
