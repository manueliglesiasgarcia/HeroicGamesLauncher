import { WorkaroundSettingsClass } from './workarounds'
import { ipcMain } from 'electron'
ipcMain.handle('listWorkarounds', async (event, appName, runner) => {
  const workaround = new WorkaroundSettingsClass(appName, runner)
  return workaround.listWorkarounds()
})

ipcMain.handle(
  'executeWorkaround',
  async (event, appName, runner, name, force) => {
    const workaround = new WorkaroundSettingsClass(appName, runner)
    return workaround.executeWorkaround(appName, runner, name, force)
  }
)
