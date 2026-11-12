const networkGuard = require('../../scripts/jest-network-guard.cjs')

test('default fetch and Node transport entry points fail closed before any socket is opened', () => {
  const attempts = [
    () => fetch('https://guard-self-test.invalid/read'),
    () => require('node:http').request('http://guard-self-test.invalid/read'),
    () => require('node:https').get('https://guard-self-test.invalid/read'),
    () => new (require('node:net').Socket)().connect({ host: 'guard-self-test.invalid', port: 443 }),
    () => require('node:net').connect({ host: 'guard-self-test.invalid', port: 443 }),
    () => require('node:tls').connect({ host: 'guard-self-test.invalid', port: 443 }),
    () => require('node:http2').connect('https://guard-self-test.invalid'),
    () => require('node:dns').lookup('guard-self-test.invalid'),
    () => require('node:dns').promises.resolve('guard-self-test.invalid'),
    () => require('node:dns').resolveTxt('guard-self-test.invalid'),
    () => new (require('node:dns').Resolver)().resolveMx('guard-self-test.invalid'),
    () => new (require('node:dns').promises.Resolver)().resolveSrv('guard-self-test.invalid'),
    () => require('node:dgram').Socket.prototype.send.call({}, 'synthetic'),
  ]
  for (const attempt of attempts) expect(attempt).toThrow('JEST_NETWORK_BLOCKED')
  const blocked = networkGuard.takeAttempts()
  expect(blocked).toHaveLength(attempts.length)
  expect(blocked.every((entry: any) => Object.keys(entry).sort().join(',') === 'host,method,transport')).toBe(true)
})

test('caught transport denials are still reported and explicit fetch fixtures remain usable', async () => {
  try { fetch('https://guard-self-test.invalid/caught') } catch { /* simulate an application catch */ }
  expect(() => networkGuard.assertNoAttempts()).toThrow('Unexpected blocked test network attempts')
  globalThis.fetch = jest.fn(async () => ({ ok: true, status: 200 })) as any
  await expect(fetch('https://fixture.invalid/read')).resolves.toMatchObject({ status: 200 })
  expect(networkGuard.takeAttempts()).toEqual([])
})

test('test application origin is synthetic and local login is disabled', () => {
  expect(require('../config/env').API_BASE_URL).toBe('https://mz-tests.invalid')
  expect(require('../config/env').LOCAL_LOGIN_ENABLED).toBe(false)
})

test('guard diagnostics do not resolve the application URL global after a test realm is torn down', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'URL')
  const lazyUrl = jest.fn(() => { throw new Error('application URL realm is unavailable') })
  Object.defineProperty(globalThis, 'URL', { configurable: true, get: lazyUrl })
  try {
    expect(() => fetch('https://guard-self-test.invalid/realm')).toThrow('JEST_NETWORK_BLOCKED')
    expect(networkGuard.takeAttempts()).toEqual([{ transport: 'fetch', method: 'GET', host: 'guard-self-test.invalid' }])
    expect(lazyUrl).not.toHaveBeenCalled()
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'URL', descriptor)
    else delete (globalThis as any).URL
  }
})
