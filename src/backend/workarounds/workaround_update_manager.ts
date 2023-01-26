import {
  createWriteStream,
  readFileSync,
  rename,
  lstatSync,
  existsSync,
  mkdirSync,
  rmSync,
  unlinkSync
} from 'graceful-fs'
import { execAsync } from '../utils'
import { logError, logInfo, LogPrefix } from '../logger/logger'
import { heroicFolder, heroicWorkaroundPath } from '../constants'
import { glob } from 'glob'
import Axios from 'axios'
import { copySync } from 'fs-extra'

const updateFolder = `${heroicFolder}/WorkaroundsUpdate`
const archivePath = `${updateFolder}/WineGameDB-workarounds.tar.gz`

const getDirectories = function (src: string) {
  return glob.sync(src + '/**/*')
}

export const workaroundUpdateManager = {
  createInfrastuctureWorkaroundUpdate: async () => {
    if (!existsSync(heroicWorkaroundPath)) {
      mkdirSync(heroicWorkaroundPath)
    }
    if (!existsSync(updateFolder)) {
      mkdirSync(updateFolder)
    }
  },
  downloadWorkaroundUpdate: async () => {
    const url =
      'https://codeload.github.com/manueliglesiasgarcia/WineGameDB/legacy.tar.gz/refs/heads/workarounds'
    const writer = createWriteStream(archivePath)

    const response = await Axios({
      url,
      method: 'GET',
      responseType: 'stream'
    })

    response.data.pipe(writer)

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve)
      writer.on('error', reject)
    })
  },

  extractWorkaroundUpdate: async () => {
    const extractCommand = `tar -xvzf ${archivePath}  --wildcards --strip-components=1 -C ${updateFolder} '*.json' `
    try {
      const { stdout } = await execAsync(extractCommand)
      logInfo(`stdout: ${stdout}`)
      unlinkSync(archivePath)
    } catch (e) {
      logError(e) // should contain code (exit code) and signal (that caused the termination).
    }
  },

  compareWorkaroundUpdate: async () => {
    const files = getDirectories(updateFolder)
    for (const file of files) {
      if (lstatSync(file).isFile()) {
        const path = file.split(updateFolder)[1]
        const updateTXT = readFileSync(`${updateFolder}${path}`)
        const updateJSON = JSON.parse(updateTXT.toString())
        if (!existsSync(`${heroicWorkaroundPath}${path}`)) {
          copySync(`${updateFolder}${path}`, `${heroicWorkaroundPath}${path}`)
        }
        const localTXT = readFileSync(`${heroicWorkaroundPath}${path}`)
        const localJSON = JSON.parse(localTXT.toString())
        const eKey = Object.keys(updateJSON).filter((k) => k !== 'executed')
        if (
          JSON.stringify(updateJSON, eKey) === JSON.stringify(localJSON, eKey)
        ) {
          logInfo(`Workaround ${path} up-to-date`, {
            prefix: LogPrefix.Backend
          })
        } else {
          logInfo(`Workaround ${path} needs update`, {
            prefix: LogPrefix.Backend
          })
          rename(
            `${updateFolder}${path}`,
            `${heroicWorkaroundPath}${path}`,
            function (err) {
              if (err) throw err
              logInfo('Successfully updated workaround', {
                prefix: LogPrefix.Backend
              })
            }
          )
        }
      }
    }
  },

  deleteWorkaroundUpdate: async () => {
    rmSync(updateFolder, { recursive: true, force: true })
  },

  updateAll: async () => {
    await workaroundUpdateManager.createInfrastuctureWorkaroundUpdate()
    await workaroundUpdateManager.downloadWorkaroundUpdate()
    await workaroundUpdateManager.extractWorkaroundUpdate()
    await workaroundUpdateManager.compareWorkaroundUpdate()
    await workaroundUpdateManager.deleteWorkaroundUpdate()
  }
}
