/* Test-only transport containment. Never delegate to a real network implementation. */
const net = require('node:net')
const { URL } = require('node:url')
const guardKey = Symbol.for('mz.jest.networkGuard')

function destination(input) {
  if (typeof input === 'string') {
    try { return new URL(input).hostname } catch { return 'non-url-destination' }
  }
  return String(input?.hostname || input?.host || 'unspecified')
}

if (!net.Socket[guardKey]) {
  const state = { attempts: [] }
  const deny = (transport, method, input) => {
    const attempt = { transport, method: String(method || 'CONNECT'), host: destination(input) }
    state.attempts.push(attempt)
    const error = new Error(`JEST_NETWORK_BLOCKED: ${attempt.transport} ${attempt.method} ${attempt.host}`)
    error.code = 'JEST_NETWORK_BLOCKED'
    throw error
  }
  state.defaultFetch = (input, init) => deny('fetch', init?.method || input?.method || 'GET', input)
  for (const protocol of ['http', 'https']) {
    const transport = require(`node:${protocol}`)
    transport.request = (input, options) => deny(protocol, options?.method || input?.method || 'GET', input)
    transport.get = (input) => deny(protocol, 'GET', input)
  }
  net.Socket.prototype.connect = function (input) { return deny('net.Socket', 'CONNECT', input) }
  net.connect = net.createConnection = (input) => deny('net', 'CONNECT', input)
  require('node:tls').connect = (input) => deny('tls', 'CONNECT', input)
  require('node:http2').connect = (input) => deny('http2', 'CONNECT', input)
  const dns = require('node:dns')
  function denyResolvers(target, label) {
    for (const name of Object.getOwnPropertyNames(target)) {
      if (/^(lookup|resolve|reverse)/.test(name) && typeof target[name] === 'function') {
        target[name] = (input) => deny(label, name, { host: input })
      }
    }
  }
  for (const [target, label] of [[dns, 'dns'], [dns.promises, 'dns.promises']]) {
    denyResolvers(target, label)
    let prototype = target.Resolver?.prototype
    while (prototype && prototype !== Object.prototype) {
      denyResolvers(prototype, `${label}.Resolver`)
      prototype = Object.getPrototypeOf(prototype)
    }
  }
  const dgram = require('node:dgram')
  dgram.Socket.prototype.send = () => deny('dgram', 'SEND', null)
  Object.defineProperty(net.Socket, guardKey, { value: state })
}

const state = net.Socket[guardKey]
function resetFetch() { globalThis.fetch = state.defaultFetch }
function takeAttempts() { return state.attempts.splice(0) }
function assertNoAttempts() {
  const attempts = takeAttempts()
  if (attempts.length) throw new Error(`Unexpected blocked test network attempts: ${JSON.stringify(attempts)}`)
}

// Only synthetic public config is visible to application code under test.
for (const key of Object.keys(process.env)) {
  if (/(TOKEN|PASSWORD|SECRET|API_KEY|DATABASE_URL|COOKIE|CREDENTIAL)/i.test(key)) delete process.env[key]
}
process.env.EXPO_PUBLIC_APP_ENV = 'dev'
process.env.EXPO_PUBLIC_API_BASE_URL = 'https://mz-tests.invalid'
process.env.EXPO_PUBLIC_API_BASE_URL_DEV = 'https://mz-tests.invalid'
process.env.EXPO_PUBLIC_API_BASE_URL_PROD = 'https://mz-tests.invalid'
process.env.EXPO_PUBLIC_LOCAL_LOGIN_ENABLED = '0'
delete process.env.EXPO_PUBLIC_LOCAL_LOGIN_USERNAME
resetFetch()

module.exports = { resetFetch, takeAttempts, assertNoAttempts }
