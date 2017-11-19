'use strict'

const child = require('mz/child_process')
const debug = require('debug')('electron-packager')
const Walker = require('pruner').Walker
const fs = require('fs-extra')

const knownPackageManagers = ['npm', 'cnpm', 'yarn']

function pruneCommand (packageManager) {
  switch (packageManager) {
    case 'npm':
    case 'cnpm':
      return `${packageManager} prune --production`
    case 'yarn':
      return `${packageManager} install --production --no-bin-links`
  }
}

function pruneModules (opts, appPath) {
  if (opts.packageManager === false) {
    const walker = new Walker(appPath)
    return walker.prune()
  } else {
    const packageManager = opts.packageManager || 'npm'

    if (packageManager === 'cnpm' && process.platform === 'win32') {
      return Promise.reject(new Error('cnpm support does not currently work with Windows, see: https://github.com/electron-userland/electron-packager/issues/515#issuecomment-297604044'))
    }

    const command = pruneCommand(packageManager)

    if (command) {
      debug(`Pruning modules via: ${command}`)
      try {
        const pkgPath = `${appPath}/package.json`
        const pkg = require(pkgPath)
        const oldDeps = pkg.dependencies
        const newDeps = {}
        if (Array.isArray(pkg.serverDependencies)) {
          for (const dep of pkg.serverDependencies) {
            newDeps[dep] = pkg.dependencies[dep]
          }
          pkg.dependencies = newDeps
          return fs.writeFile(pkgPath, JSON.stringify(pkg), 'utf-8')
          .then(() => child.exec(command, { cwd: appPath }))
          .then(() => {
            pkg.dependencies = oldDeps;
            return fs.writeFile(pkgPath, JSON.stringify(pkg, null, 4), 'utf-8');
          })
        }
      } catch (e) {}
      return child.exec(command, { cwd: appPath })
    } else {
      return Promise.reject(new Error(`Unknown package manager "${packageManager}". Known package managers: ${knownPackageManagers.join(', ')}`))
    }
  }
}

module.exports = {
  pruneCommand: pruneCommand,
  pruneModules: pruneModules
}
