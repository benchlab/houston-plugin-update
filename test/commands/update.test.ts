import {expect} from 'chai'
import * as path from 'path'
import * as qq from 'qqjs'

const skipIfWindows = process.platform === 'win32' ? it.skip : it

describe('update', () => {
  skipIfWindows('tests the updater', async () => {
    await qq.rm([process.env.HOME!, '.local', 'share', 'lyndon-example-s3-houston'])
    await qq.x('aws s3 rm --recursive s3://lyndon-staging/s3-update-example-houston')
    const sha = await qq.x.stdout('git', ['rev-parse', '--short', 'HEAD'])
    const stdout = await qq.x.stdout('npm', ['pack', '--unsafe-perm'])
    const tarball = path.resolve(stdout.split('\n').pop()!)

    qq.cd('examples/s3-update-example-houston')
    process.env.EXAMPLE_HOUSTON_DISABLE_AUTOUPDATE = '1'
    process.env.YARN_CACHE_FOLDER = path.resolve('tmp', 'yarn')
    await qq.rm(process.env.YARN_CACHE_FOLDER)
    const pjson = await qq.readJSON('package.json')
    delete pjson.dependencies['houston-plugin-update']
    await qq.writeJSON('package.json', pjson)

    await qq.rm('yarn.lock')
    await qq.x(`yarn add ${tarball}`)
    // await qq.x('yarn')

    const release = async (version: string) => {
      const pjson = await qq.readJSON('package.json')
      pjson.version = version
      await qq.writeJSON('package.json', pjson)
      await qq.x('./node_modules/.bin/lyndon-helper pack')
      await qq.x('./node_modules/.bin/lyndon-helper publish')
    }
    const checkVersion = async (version: string, nodeVersion = pjson.lyndon.update.node.version) => {
      const stdout = await qq.x.stdout('./tmp/example-houston/bin/example-houston', ['version'])
      expect(stdout).to.equal(`s3-update-example-houston/${version} ${process.platform}-${process.arch} node-v${nodeVersion}`)
    }
    const update = async (channel?: string) => {
      const f = 'tmp/example-houston/package.json'
      const pjson = await qq.readJSON(f)
      pjson.version = '0.0.0'
      await qq.writeJSON(f, pjson)
      const args = ['update']
      if (channel) args.push(channel)
      await qq.x('./tmp/example-houston/bin/example-houston', args)
    }
    await release('1.0.0')
    await checkVersion('1.0.0', process.versions.node)
    await release('2.0.0-beta')
    await checkVersion(`2.0.0-beta.${sha}`, process.versions.node)
    await update()
    await checkVersion('1.0.0')
    await release('1.0.1')
    await checkVersion('1.0.0')
    await update()
    await checkVersion('1.0.1')
    await update()
    await checkVersion('1.0.1')
    await update('beta')
    await checkVersion(`2.0.0-beta.${sha}`)
    await release('2.0.1-beta')
    await checkVersion(`2.0.0-beta.${sha}`)
    await update()
    await checkVersion(`2.0.1-beta.${sha}`)
    await update()
    await checkVersion(`2.0.1-beta.${sha}`)
    await release('1.0.3')
    await update()
    await checkVersion(`2.0.1-beta.${sha}`)
    await update('stable')
    await checkVersion('1.0.3')
  })
})
