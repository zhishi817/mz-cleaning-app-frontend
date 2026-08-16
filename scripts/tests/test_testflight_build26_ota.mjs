import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import {
  BUILD_26_OTA_CONTRACT,
  buildPinnedAppContent,
  classifyChangedPaths,
  parseArgs,
  verifyPublishReceipt,
  withBuild26Runtime,
} from '../testflight_build26_ota.mjs'

const fingerprintApp = JSON.stringify({ expo: { name: 'MZStay', runtimeVersion: { policy: 'fingerprint' } } }, null, 2)

test('Build 26 contract only permits JS, documentation and release-script changes', () => {
  const scope = classifyChangedPaths([
    'src/screens/tabs/NoticesScreen.tsx',
    'docs/feature-regression-registry.md',
    'scripts/testflight_build26_ota.mjs',
    'app.json',
    'ios/Podfile',
    'package-lock.json',
  ])
  assert.deepEqual(scope.allowed, [
    'src/screens/tabs/NoticesScreen.tsx',
    'docs/feature-regression-registry.md',
    'scripts/testflight_build26_ota.mjs',
  ])
  assert.deepEqual(scope.blocked, ['app.json', 'ios/Podfile', 'package-lock.json'])
})

test('pinned runtime targets Build 26 but requires fingerprint at rest', () => {
  const pinned = JSON.parse(buildPinnedAppContent(fingerprintApp))
  assert.equal(pinned.expo.runtimeVersion, BUILD_26_OTA_CONTRACT.runtimeVersion)
  assert.throws(() => buildPinnedAppContent(JSON.stringify({ expo: { runtimeVersion: 'other-runtime' } })), /fingerprint/)
})

test('temporary runtime binding restores the exact app.json bytes after failure', () => {
  const directory = mkdtempSync(join(tmpdir(), 'mz-build26-runtime-test-'))
  const appPath = join(directory, 'app.json')
  const original = `${fingerprintApp}\n`
  writeFileSync(appPath, original)
  try {
    assert.throws(() => withBuild26Runtime(appPath, () => {
      assert.equal(JSON.parse(readFileSync(appPath, 'utf8')).expo.runtimeVersion, BUILD_26_OTA_CONTRACT.runtimeVersion)
      throw new Error('simulated publish failure')
    }), /simulated publish failure/)
    assert.equal(readFileSync(appPath, 'utf8'), original)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('publish is opt-in and requires a release message', () => {
  assert.deepEqual(parseArgs(['--check']), { publish: false, message: '' })
  assert.throws(() => parseArgs(['--publish']), /--message/)
  assert.deepEqual(parseArgs(['--publish', '--message', '通知照片认证读取']), { publish: true, message: '通知照片认证读取' })
})

test('EAS receipt must report the pinned runtime and an update group', () => {
  assert.deepEqual(
    verifyPublishReceipt([{ group: 'group-1', runtimeVersion: BUILD_26_OTA_CONTRACT.runtimeVersion }]),
    { group: 'group-1', runtimeVersion: BUILD_26_OTA_CONTRACT.runtimeVersion },
  )
  assert.throws(() => verifyPublishReceipt([{ group: 'group-1', runtimeVersion: 'wrong-runtime' }]), /目标 runtime/)
})
