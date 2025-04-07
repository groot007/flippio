import fs from 'node:fs'
import { dialog, ipcMain } from 'electron'

export function setupIpcCommon() {
  ipcMain.handle('dialog:selectFile', async (_event, options) => {
    const result = await dialog.showOpenDialog(options)
    return result
  })

  ipcMain.handle('dialog:saveFile', async (_event, options) => {
    const { canceled, filePath } = await dialog.showSaveDialog(options)

    if (!canceled && filePath) {
      fs.copyFileSync(options.dbFilePath, filePath)
    }

    return filePath
  })
}
