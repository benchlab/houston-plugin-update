import * as spawn from 'cross-spawn'
import * as fs from 'fs-extra'
import * as Config from 'lyndon-config'
import houston from 'lyndon-io'
import * as path from 'path'

import {touch} from '../util'

const debug = require('debug')('houston:updater')

function timestamp(msg: string): string {
  return `[${new Date().toISOString()}] ${msg}`
}

async function mtime(f: string) {
  const {mtime} = await fs.stat(f)
  return mtime
}

export const init: Config.Hook<'init'> = async function (opts) {
  if (opts.id === 'update') return
  houston.config.errlog = opts.config.errlog
  const binPath = this.config.binPath
  if (!binPath) return this.debug('no binpath set')
  const lastrunfile = path.join(this.config.cacheDir, 'lastrun')
  const autoupdatefile = path.join(this.config.cacheDir, 'autoupdate')
  const autoupdatelogfile = path.join(this.config.cacheDir, 'autoupdate.log')
  const clientRoot = path.join(this.config.dataDir, 'client')

  const autoupdateEnv = {
    ...process.env,
    [this.config.scopedEnvVarKey('TIMESTAMPS')]: '1',
    [this.config.scopedEnvVarKey('SKIP_ANALYTICS')]: '1',
  }

  async function autoupdateNeeded(): Promise<boolean> {
    try {
      const m = await mtime(autoupdatefile)
      m.setHours(m.getHours() + 5)
      return m < new Date()
    } catch (err) {
      if (err.code !== 'ENOENT') houston.error(err.stack)
      if ((global as any).testing) return false
      debug('autoupdate ENOENT')
      return true
    }
  }

  await touch(lastrunfile)
  const clientDir = path.join(clientRoot, this.config.version)
  if (await fs.pathExists(clientDir)) await touch(clientDir)
  if (!await autoupdateNeeded()) return

  debug('autoupdate running')
  await fs.outputFile(autoupdatefile, '')

  debug(`spawning autoupdate on ${binPath}`)

  let fd = await fs.open(autoupdatelogfile, 'a')
  // @ts-ignore
  fs.write(
    fd,
    timestamp(`starting \`${binPath} update --autoupdate\` from ${process.argv.slice(1, 3).join(' ')}\n`),
  )

  spawn(binPath, ['update', '--autoupdate'], {
    detached: !this.config.windows,
    stdio: ['ignore', fd, fd],
    env: autoupdateEnv,
  })
    .on('error', (e: Error) => process.emitWarning(e))
    .unref()
}
