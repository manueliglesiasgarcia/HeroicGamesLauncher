import {
  readdirSync,
  readFileSync,
  copyFileSync,
  existsSync,
  unlinkSync,
  writeFileSync,
  linkSync
} from 'graceful-fs'
import path from 'node:path'
import { EnviromentVariable, GameInfo, Runner } from 'common/types'
import { heroicWorkaroundPath } from '../constants'
import { logError, logInfo, LogPrefix } from '../logger/logger'
import { DXVK, Winetricks } from '../tools'
import {
  getLatestVersion,
  install,
  enable
} from '../legendary/eos_overlay/eos_overlay'
import { Game } from 'backend/games'
import { download } from '../wine/runtimes/runtimes'
import { getGame } from 'backend/utils'

export type regeditType =
  | 'REG_BINARY'
  | 'REG_DWORD'
  | 'REG_QWORD'
  | 'REG_DWORD_LITTLE_ENDIAN'
  | 'REG_QWORD_LITTLE_ENDIAN'
  | 'REG_DWORD_BIG_ENDIAN'
  | 'REG_EXPAND_SZ'
  | 'REG_LINK'
  | 'REG_MULTI_SZ'
  | 'REG_NONE'
  | 'REG_RESOURCE_LIST'
  | 'REG_SZ'

export interface WorkaroundSettings {
  id: string
  title: string
  required: boolean
  runner: Runner
  executed: boolean
  dxvk_required: boolean
  vkd3d_proton_required: boolean
  wined3d_required: boolean
  fsync_enable: boolean
  esync_enable: boolean
  eac_enable: boolean
  eos_enable: boolean
  battleye_enable: boolean
  override_exe: string
  start_params: string
  env_var: EnviromentVariable[]
  winetricks: string[]
  copy_file: {
    src: string
    dst: string
    symlink: boolean
  }[]
  delete_file: {
    src: string
  }[]
  regedit: {
    folder: string
    name: string
    type: regeditType
    value: string
    arch: boolean
  }[]
}
class WorkaroundSettingsClass {
  public id: WorkaroundSettings['id'] = 'default'
  public title: WorkaroundSettings['title'] = 'Default'
  public required: WorkaroundSettings['required'] = true
  public runner: WorkaroundSettings['runner'] = 'legendary'
  public executed: WorkaroundSettings['executed'] = false
  public dxvk_required: WorkaroundSettings['dxvk_required'] = true
  public vkd3d_proton_required: WorkaroundSettings['vkd3d_proton_required'] =
    true
  public wined3d_required: WorkaroundSettings['wined3d_required'] = false
  public fsync_enable: WorkaroundSettings['fsync_enable'] = true
  public esync_enable: WorkaroundSettings['esync_enable'] = true
  public eac_enable: WorkaroundSettings['eac_enable'] = false
  public eos_enable: WorkaroundSettings['eos_enable'] = false
  public battleye_enable: WorkaroundSettings['battleye_enable'] = false
  public override_exe = ''
  public start_params = ''
  public env_var: WorkaroundSettings['env_var'] = []
  public winetricks: WorkaroundSettings['winetricks'] = []
  public copy_file: WorkaroundSettings['copy_file'] = []
  public delete_file: WorkaroundSettings['delete_file'] = []
  public regedit: WorkaroundSettings['regedit'] = []

  public constructor(id: string, runner: Runner) {
    this.id = id
    this.runner = runner
  }

  public async writeDefaultWorkaround() {
    writeFileSync(
      await this.getDefaultWorkaroundPath(),
      JSON.stringify(
        new WorkaroundSettingsClass('default', 'legendary'),
        null,
        2
      )
    )
  }

  public async getDefaultWorkaroundPath() {
    return path.join(heroicWorkaroundPath, 'default.json')
  }

  public async getWorkaroundPath(name = 'default') {
    return `${heroicWorkaroundPath}/${this.runner}-${this.id}/${name}.json`
  }

  public async listWorkarounds() {
    const existfolder = existsSync(
      `${heroicWorkaroundPath}/${this.runner}-${this.id}/`
    )
    if (existfolder) {
      const files = readdirSync(
        `${heroicWorkaroundPath}/${this.runner}-${this.id}/`
      )
      const jsonExtensionLess = JSON.parse('[]')
      for (const file of files) {
        const WorkaroundSettingsObj = await this.readWorkaround(
          file.split('.json')[0]
        )
        const json = JSON.parse('{}')
        json['name'] = file.split('.json')[0]
        json['executed'] = WorkaroundSettingsObj.executed
        jsonExtensionLess.push(json)
      }
      return jsonExtensionLess
    }

    return existfolder
  }

  /**
   * Get path based on the workaround JSON
   */
  public async guessPath(path: string, game: Game, regedit = false) {
    const gameInfo = game.getGameInfo()
    const gameSettings = await game.getSettings()
    const install_path = gameInfo.install.install_path!
    const winePrefix = gameSettings.winePrefix
    const windows_install_path = install_path.replaceAll('/', '\\')
    const root_path: string = path.substring(
      path.indexOf('{') + 1,
      path.lastIndexOf('}')
    )
    const path_novar: string = path.split('}')[1]
    if (!regedit) {
      if (root_path === 'GAMEDIR') {
        const final_path = install_path + path_novar
        return final_path
      }
      if (root_path === 'WINEDIR') {
        const final_path = winePrefix + path_novar
        return final_path
      } else {
        return path
      }
    } else {
      if (root_path === 'GAMEDIR') {
        const final_path = `z:${windows_install_path}${path_novar}`
        return final_path
      }
      if (root_path === 'WINEDIR') {
        const final_path = `c:${path_novar}`
        return final_path
      } else {
        return path
      }
    }
  }

  public async copyFile(json_workaround: WorkaroundSettings, game: Game) {
    const workaround = json_workaround
    for (const key in workaround.copy_file) {
      if ('copy_file' in workaround) {
        const src: string = workaround.copy_file[key]['src']
        const dst: string = workaround.copy_file[key]['dst']
        const symlink: boolean = workaround.copy_file[key]['symlink']
        const src_folder: string = await this.guessPath(src, game)
        const dst_folder: string = await this.guessPath(dst, game)
        if (symlink) {
          logInfo('Symlink file from ' + src_folder + ' to ' + dst_folder, {
            prefix: LogPrefix.Backend
          })
          linkSync(src_folder, dst_folder)
        } else {
          logInfo('Copying file from ' + src_folder + ' to ' + dst_folder, {
            prefix: LogPrefix.Backend
          })
          copyFileSync(src_folder, dst_folder)
        }
      }
    }
  }

  public async deleteFile(json_workaround: WorkaroundSettings, game: Game) {
    const workaround = json_workaround
    for (const key in workaround.delete_file) {
      if ('delete_file' in workaround) {
        const src: string = workaround.delete_file[key]['src']
        const src_folder: string = await this.guessPath(src, game)
        logInfo('Deleting file from ' + src_folder, {
          prefix: LogPrefix.Backend
        })
        try {
          unlinkSync(src_folder)
        } catch (error) {
          logError('' + error)
        }
      }
    }
  }

  public async regedit_add(
    game: Game,
    folder: string,
    name?: string,
    type?: regeditType,
    value?: string,
    arch?: boolean
  ) {
    if (name && type && value) {
      logInfo(`Regedit add value ${folder} ${value}`, {
        prefix: LogPrefix.Backend
      })

      if (arch) {
        await game.runWineCommand([
          `reg add '${folder}' /f /v '${name}' /t '${type}' /d "${value}" /reg:64`
        ])
      } else {
        await game.runWineCommand([
          `reg add '${folder}' /f /v '${name}' /t '${type}' /d '${value}'`
        ])
      }
    } else {
      logInfo(`Regedit add folder ${folder}`, {
        prefix: LogPrefix.Backend
      })
      if (arch) {
        await game.runWineCommand([`reg add '${folder}' /f /reg:64`])
      } else {
        await game.runWineCommand([`reg add '${folder}' /f`])
      }
    }
  }

  /**
   * Mark workaround as executed
   */
  public async executedWorkaround() {
    const WorkaroundSettingsObj = await this.readWorkaround()
    if (WorkaroundSettingsObj.id !== 'default') {
      WorkaroundSettingsObj.executed = true
      writeFileSync(
        await this.getWorkaroundPath(),
        JSON.stringify(WorkaroundSettingsObj, null, 2)
      )
    }
  }

  public async readWorkaround(name = 'default') {
    const WorkaroundSettingsObj = new WorkaroundSettingsClass(
      this.id,
      this.runner
    )

    if (existsSync(await this.getWorkaroundPath())) {
      logInfo('Reading manual workaround', {
        prefix: LogPrefix.Backend
      })
      Object.assign(
        WorkaroundSettingsObj,
        JSON.parse(readFileSync(await this.getWorkaroundPath(name), 'utf-8'))
      )
      return WorkaroundSettingsObj
    } else {
      logInfo('Reading default workaround', {
        prefix: LogPrefix.Backend
      })
      Object.assign(
        WorkaroundSettingsObj,
        JSON.parse(readFileSync(await this.getDefaultWorkaroundPath(), 'utf-8'))
      )
      return WorkaroundSettingsObj
    }
  }

  public async getOverwriteExe(gameInfo: GameInfo) {
    const install_path = gameInfo.install.install_path
    const WorkaroundSettingsObj = await this.readWorkaround()
    if (!WorkaroundSettingsObj.override_exe) {
      return ''
    } else {
      WorkaroundSettingsObj.override_exe =
        install_path + WorkaroundSettingsObj.override_exe.split('}')[1]
      logInfo(`Overwrite exe ${WorkaroundSettingsObj.override_exe}`, {
        prefix: LogPrefix.Backend
      })
      return WorkaroundSettingsObj.override_exe
    }
  }

  public async updateD3DWrappers(
    game: Game,
    json_workaround: WorkaroundSettings
  ) {
    const gameSettings = await game.getSettings()
    if (
      json_workaround.wined3d_required &&
      gameSettings.wineVersion.type === 'wine'
    ) {
      await DXVK.installRemove(
        gameSettings.winePrefix,
        gameSettings.wineVersion.bin,
        'dxvk',
        'restore'
      )
      await DXVK.installRemove(
        gameSettings.winePrefix,
        gameSettings.wineVersion.bin,
        'vkd3d',
        'restore'
      )
    }
    if (
      json_workaround.dxvk_required &&
      gameSettings.wineVersion.type === 'wine'
    ) {
      await DXVK.installRemove(
        gameSettings.winePrefix,
        gameSettings.wineVersion.bin,
        'dxvk',
        'backup'
      )
    }
    if (
      json_workaround.vkd3d_proton_required &&
      gameSettings.wineVersion.type === 'wine'
    ) {
      await DXVK.installRemove(
        gameSettings.winePrefix,
        gameSettings.wineVersion.bin,
        'vkd3d',
        'backup'
      )
    }
  }

  public async executeWinetricks(
    game: Game,
    json_workaround: WorkaroundSettings
  ) {
    const gameSettings = await game.getSettings()
    for (const key in json_workaround.winetricks) {
      await Winetricks.run(
        gameSettings.wineVersion,
        gameSettings.winePrefix,
        json_workaround.winetricks[key]
      )
    }
  }

  /**
   * Execute all workarounds before the game boots
   */
  public async executeWorkaround(
    appname: string,
    runner: Runner,
    name = 'default',
    force = false
  ) {
    const json_workaround = await this.readWorkaround(name)
    const game = getGame(appname, runner)
    if (!json_workaround.executed || force) {
      logInfo(`Executing workaround`, {
        prefix: LogPrefix.Backend
      })
      for (const key in json_workaround.regedit) {
        if ('regedit' in json_workaround) {
          const folder = json_workaround.regedit[key]['folder']
          const name = json_workaround.regedit[key]['name']
          const type = json_workaround.regedit[key]['type']
          const arch = json_workaround.regedit[key]['arch']
          const value = await this.guessPath(
            json_workaround.regedit[key]['value'],
            game,
            true
          )
          await this.regedit_add(game, folder, name, type, value, arch)
        }
      }

      if ('winetricks' in json_workaround) {
        this.executeWinetricks(game, json_workaround)
      }
      this.deleteFile(json_workaround, game)
      this.copyFile(json_workaround, game)
      if (json_workaround.eos_enable) {
        await getLatestVersion()
        await install()
        await enable(this.id)
      }
      if (json_workaround.eac_enable) {
        download('eac_runtime')
      }
      if (json_workaround.battleye_enable) {
        download('battleye_runtime')
      }

      await this.updateD3DWrappers(game, json_workaround)
      await this.executedWorkaround()
      return true
    } else {
      logInfo(`Workaround already used`, {
        prefix: LogPrefix.Backend
      })
      return false
    }
  }
}

export { WorkaroundSettingsClass }
