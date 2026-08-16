#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join, resolve } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'

export const BUILD_26_OTA_CONTRACT = Object.freeze({
  id: 'ios-testflight-build26',
  baseCommit: '195b9e8ae26a13a9f9e604dd2cb4bb8eb8dda3e0',
  runtimeVersion: 'e5f4cc520509f2b64df725bf8eef5a9a42dc0e8a',
  channel: 'testflight',
  environment: 'production',
  platform: 'ios',
})

const ALLOWED_PREFIXES = ['src/', 'docs/', 'scripts/']
const BLOCKED_PATHS = [
  'app.json',
  'app.config.js',
  'app.config.ts',
  'eas.json',
  'package.json',
  'package-lock.json',
  'ios/',
  'android/',
  'plugins/',
  'assets/',
  'babel.config.js',
  'metro.config.js',
]

export function classifyChangedPaths(paths) {
  const blocked = paths.filter((path) => {
    if (BLOCKED_PATHS.some((blockedPath) => path === blockedPath || path.startsWith(blockedPath))) return true
    return !ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))
  })
  return { allowed: paths.filter((path) => !blocked.includes(path)), blocked }
}

export function buildPinnedAppContent(originalContent) {
  const parsed = JSON.parse(originalContent)
  const expo = parsed?.expo
  if (!expo || typeof expo !== 'object') throw new Error('app.json 缺少 expo 配置。')
  const runtime = expo.runtimeVersion
  if (!runtime || typeof runtime !== 'object' || runtime.policy !== 'fingerprint') {
    throw new Error('app.json 必须在静止状态保持 runtimeVersion.policy="fingerprint"。')
  }
  return `${JSON.stringify({
    ...parsed,
    expo: { ...expo, runtimeVersion: BUILD_26_OTA_CONTRACT.runtimeVersion },
  }, null, 2)}\n`
}

export function withBuild26Runtime(appJsonPath, work) {
  const original = readFileSync(appJsonPath, 'utf8')
  writeFileSync(appJsonPath, buildPinnedAppContent(original))
  try {
    return work()
  } finally {
    writeFileSync(appJsonPath, original)
  }
}

function runGit(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

function assertGitSuccess(cwd, args, message) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(message)
}

export function preflight(cwd) {
  const status = runGit(cwd, ['status', '--porcelain'])
  if (status) throw new Error('发布工作树必须干净；请使用隔离的最新 origin/Dev 工作树。')

  try {
    runGit(cwd, ['fetch', '--quiet', 'origin', 'Dev'])
  } catch {
    throw new Error('无法刷新 origin/Dev；请恢复网络或远端访问后重试。')
  }

  const head = runGit(cwd, ['rev-parse', 'HEAD'])
  const originDev = runGit(cwd, ['rev-parse', 'origin/Dev'])
  if (head !== originDev) throw new Error(`HEAD (${head}) 不是最新 origin/Dev (${originDev})。`)

  assertGitSuccess(cwd, ['merge-base', '--is-ancestor', BUILD_26_OTA_CONTRACT.baseCommit, 'HEAD'], '当前 Dev 不包含 Build 26 兼容基线。')
  const changedPaths = runGit(cwd, ['diff', '--name-only', `${BUILD_26_OTA_CONTRACT.baseCommit}...HEAD`])
    .split('\n')
    .map((path) => path.trim())
    .filter(Boolean)
  const scope = classifyChangedPaths(changedPaths)
  if (scope.blocked.length) throw new Error(`Build 26 OTA 被原生/未知改动阻断：${scope.blocked.join(', ')}`)

  buildPinnedAppContent(readFileSync(join(cwd, 'app.json'), 'utf8'))
  return { head, changedPaths, contract: BUILD_26_OTA_CONTRACT }
}

export function parseArgs(args) {
  const parsed = { publish: false, message: '' }
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]
    if (value === '--check') continue
    if (value === '--publish') {
      parsed.publish = true
      continue
    }
    if (value === '--message') {
      parsed.message = String(args[index + 1] || '').trim()
      index += 1
      continue
    }
    throw new Error(`不支持的参数：${value}`)
  }
  if (parsed.publish && !parsed.message) throw new Error('--publish 必须同时提供 --message。')
  return parsed
}

function parseEasJson(output) {
  try {
    return JSON.parse(output)
  } catch {
    throw new Error('EAS 未返回可验证的 JSON 发布回执。')
  }
}

function collectValues(value, keys, values = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectValues(item, keys, values))
  } else if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      if (keys.has(key) && typeof nested === 'string') values.push(nested)
      collectValues(nested, keys, values)
    }
  }
  return values
}

export function verifyPublishReceipt(receipt) {
  const runtimeVersions = collectValues(receipt, new Set(['runtimeVersion', 'runtime_version']))
  if (!runtimeVersions.includes(BUILD_26_OTA_CONTRACT.runtimeVersion)) {
    throw new Error('EAS 发布回执没有确认 Build 26 的目标 runtime；已发布状态需要人工核验。')
  }
  const groups = collectValues(receipt, new Set(['group', 'groupId', 'group_id']))
  if (!groups.length) throw new Error('EAS 发布回执没有 update group；已发布状态需要人工核验。')
  return { runtimeVersion: BUILD_26_OTA_CONTRACT.runtimeVersion, group: groups[0] }
}

function publish(cwd, message) {
  let result
  try {
    result = withBuild26Runtime(join(cwd, 'app.json'), () => spawnSync(
      'npx',
      [
        'eas-cli@latest', 'update',
        '--channel', BUILD_26_OTA_CONTRACT.channel,
        '--environment', BUILD_26_OTA_CONTRACT.environment,
        '--platform', BUILD_26_OTA_CONTRACT.platform,
        '--message', message,
        '--non-interactive', '--json',
      ],
      { cwd, encoding: 'utf8' },
    ))
  } finally {
    assertGitSuccess(cwd, ['diff', '--quiet', '--', 'app.json'], '发布后 app.json 未恢复；停止后续操作。')
  }
  if (result.status !== 0) throw new Error(`EAS OTA 发布失败：${String(result.stderr || result.stdout || 'unknown error').trim()}`)
  return verifyPublishReceipt(parseEasJson(result.stdout))
}

export function main(argv = process.argv.slice(2), cwd = process.cwd()) {
  const args = parseArgs(argv)
  const result = preflight(resolve(cwd))
  if (!args.publish) {
    console.log(JSON.stringify({ mode: 'check', ...result }, null, 2))
    return result
  }
  const receipt = publish(resolve(cwd), args.message)
  console.log(JSON.stringify({ mode: 'published', ...result, receipt }, null, 2))
  return { ...result, receipt }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
