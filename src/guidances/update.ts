import color from '@heroku-cli/color'
import * as spawn from 'cross-spawn'
import * as fs from 'fs-extra'
import Guidance, {flags} from 'guidancejs'
import HTTP from 'http-call'
import * as _ from 'lodash'
import {IManifest} from 'lyndon-helper'
import houston from 'lyndon-io'
import * as path from 'path'

import {extract} from '../tar'
import {ls, wait} from '../util'

export default class UpdateGuidance extends Guidance {
  static description = 'update the <%= config.bin %> HOUSTON'
  static args = [{name: 'channel', optional: true}]
  static flags = {
    autoupdate: flags.boolean({hidden: true}),
  }

  private autoupdate!: boolean
  private channel!: string
  private readonly clientRoot = path.join(this.config.dataDir, 'client')
  private readonly clientBin = path.join(this.clientRoot, 'bin', this.config.windows ? `${this.config.bin}.cmd` : this.config.bin)

  async run() {
    const {args, flags} = this.parse(UpdateGuidance)
    this.autoupdate = !!flags.autoupdate

    if (this.autoupdate) await this.debounce()

    houston.action.start(`${this.config.name}: Updating HOUSTON`)
    this.channel = args.channel || this.config.channel || 'stable'
    const manifest = await this.fetchManifest()
    let reason = await this.skipUpdate()
    if (reason) houston.action.stop(reason || 'done')
    else await this.update(manifest)
    this.debug('tidy')
    await this.tidy()
    await this.config.runHook('update', {channel: this.channel})
    this.debug('done')
    houston.action.stop()
  }

  private async fetchManifest(): Promise<IManifest> {
    const http: typeof HTTP = require('http-call').HTTP
    try {
      const url = this.config.s3Url(this.config.s3Key('manifest', {
        channel: this.channel,
        platform: this.config.platform,
        arch: this.config.arch
      }))
      let {body} = await http.get(url)
      return body
    } catch (err) {
      if (err.statusCode === 403) throw new Error(`HTTP 403: Invalid channel ${this.channel}`)
      throw err
    }
  }

  private async update(manifest: IManifest) {
    const {version, channel} = manifest
    houston.action.start(`${this.config.name}: Updating HOUSTON from ${color.green(this.config.version)} to ${color.green(version)}${channel === 'stable' ? '' : ' (' + color.yellow(channel) + ')'}`)
    const http: typeof HTTP = require('http-call').HTTP
    const filesize = (n: number): string => {
      const [num, suffix] = require('filesize')(n, {output: 'array'})
      return num.toFixed(1) + ` ${suffix}`
    }
    const output = path.join(this.clientRoot, version)

    const {response: stream} = await http.stream(manifest.gz)
    stream.pause()

    let extraction = extract(stream, manifest.baseDir, output, manifest.sha256gz)

    // TODO: use houston.action.type
    if ((houston.action as any).frames) {
      // if spinner action
      let total = parseInt(stream.headers['content-length']!, 10)
      let current = 0
      const updateStatus = _.throttle(
        (newStatus: string) => {
          houston.action.status = newStatus
        },
        500,
        {leading: true, trailing: false},
      )
      stream.on('data', data => {
        current += data.length
        updateStatus(`${filesize(current)}/${filesize(total)}`)
      })
    }

    stream.resume()
    await extraction

    await this.createBin(version)
    await this.reexec()
  }

  private async skipUpdate(): Promise<string | false> {
    if (!this.config.binPath) return 'not updatable'
    if (this.autoupdate && this.config.scopedEnvVar('DISABLE_AUTOUPDATE') === '1') return 'autoupdates disabled'
    const manifest = await this.fetchManifest()
    if (this.config.version === manifest.version) {
      if (this.config.scopedEnvVar('HIDE_UPDATED_MESSAGE')) return 'done'
      return `already on latest version: ${this.config.version}`
    }
    return false
  }

  private async logChop() {
    try {
      this.debug('log chop')
      const logChopper = require('log-chopper').default
      await logChopper.chop(this.config.errlog)
    } catch (e) {
      this.debug(e.message)
    }
  }

  private async mtime(f: string) {
    const {mtime} = await fs.stat(f)
    return mtime
  }

  // when autoupdating, wait until HOUSTON isn't active
  private async debounce(): Promise<void> {
    let output = false
    const lastrunfile = path.join(this.config.cacheDir, 'lastrun')
    const m = await this.mtime(lastrunfile)
    m.setHours(m.getHours() + 1)
    if (m > new Date()) {
      const msg = `waiting until ${m.toISOString()} to update`
      if (output) {
        this.debug(msg)
      } else {
        await houston.log(msg)
        output = true
      }
      await wait(60 * 1000) // wait 1 minute
      return this.debounce()
    }
    houston.log('time to update')
  }

  // removes any unused HOUSTON plugins
  private async tidy() {
    try {
      let root = this.clientRoot
      if (!await fs.pathExists(root)) return
      let files = await ls(root)
      let promises = files.map(async f => {
        if (['bin', this.config.version].includes(path.basename(f.path))) return
        const mtime = f.stat.mtime
        mtime.setHours(mtime.getHours() + 7 * 24)
        if (mtime < new Date()) {
          await fs.remove(f.path)
        }
      })
      for (let p of promises) await p
      await this.logChop()
    } catch (err) {
      houston.warn(err)
    }
  }

  private async reexec() {
    houston.action.stop()
    return new Promise((_, reject) => {
      this.debug('restarting HOUSTON after update', this.clientBin)
      spawn(this.clientBin, ['update'], {
        stdio: 'inherit',
        env: {...process.env, [this.config.scopedEnvVarKey('HIDE_UPDATED_MESSAGE')]: '1'},
      })
        .on('error', reject)
        .on('close', (status: number) => {
          try {
            this.exit(status)
          } catch (err) {
            reject(err)
          }
        })
    })
  }

  private async createBin(version: string) {
    const dst = this.clientBin
    const {bin} = this.config
    const binPathEnvVar = this.config.scopedEnvVarKey('BINPATH')
    const redirectedEnvVar = this.config.scopedEnvVarKey('REDIRECTED')
    if (this.config.windows) {
      let body = `@echo off
setlocal enableextensions
set ${redirectedEnvVar}="1"
set ${binPathEnvVar}="%~dp0${bin}"
"%~dp0..\\${version}\\bin\\${bin}.cmd" %*
`
      await fs.outputFile(dst, body)
    } else {
      let body = `#!/usr/bin/env bash
set -e
get_script_dir () {
  SOURCE="\${BASH_SOURCE[0]}"
  # While $SOURCE is a symlink, resolve it
  while [ -h "$SOURCE" ]; do
    DIR="$( cd -P "$( dirname "$SOURCE" )" && pwd )"
    SOURCE="$( readlink "$SOURCE" )"
    # If $SOURCE was a relative symlink (so no "/" as prefix, need to resolve it relative to the symlink base directory
    [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE"
  done
  DIR="$( cd -P "$( dirname "$SOURCE" )" && pwd )"
  echo "$DIR"
}
DIR=$(get_script_dir)
${binPathEnvVar}="\$DIR/${bin}" ${redirectedEnvVar}=1 "$DIR/../${version}/bin/${bin}" "$@"
`

      await fs.remove(dst)
      await fs.outputFile(dst, body)
      await fs.chmod(dst, 0o755)
    }
  }
}
