import { credentialKey } from '@deepseek-ai/dsh-credentials'
import { createCodexProvider } from './provider.js'
import { CodexBridgeRemoteService } from './remote-service.js'

const name = 'dsh-codex-bridge'
const inject = ['credentials']
const CREDENTIAL_KEY = credentialKey('llm-pi-ai', 'openai-codex')
const REFRESH_LEEWAY_MS = 60_000
const REFRESH_TIMEOUT_MS = 30_000

const PI_PROVIDER = createCodexProvider()
const CODEX_OAUTH = PI_PROVIDER.auth?.oauth
if (CODEX_OAUTH === undefined) throw new Error('pi-ai OpenAI Codex provider does not expose OAuth')

function trustedVerificationUri(value) {
  let url
  try { url = new URL(value) } catch { throw new Error('OpenAI returned an invalid verification URL') }
  if (url.protocol !== 'https:' || url.hostname !== 'auth.openai.com') {
    throw new Error('OpenAI returned an untrusted verification URL')
  }
  return url.toString()
}

function createService(ctx, handlers) {
  const state = {
    status: 'idle',
    loggedIn: false,
    deviceCode: '',
    verificationUri: '',
    expiresAt: 0,
    error: '',
  }

  let activeFlow = null
  let flowGeneration = 0
  let credentialRevision = 0
  let refreshInFlight = null
  let credentialMutationTail = Promise.resolve()

  const snapshot = () => ({ ...state })
  const clearTransient = () => Object.assign(state, { deviceCode: '', verificationUri: '', error: '' })
  const mutateCredential = (operation) => {
    const result = credentialMutationTail.catch(() => {}).then(operation)
    credentialMutationTail = result.catch(() => {})
    return result
  }

  const readCredential = async () => {
    const record = await ctx.credentials.readRecord(CREDENTIAL_KEY)
    const value = record?.kind === 'grant' ? record.payload : undefined
    if (value?.type !== 'oauth'
      || typeof value.access !== 'string' || value.access.length === 0
      || typeof value.refresh !== 'string' || value.refresh.length === 0
      || typeof value.expires !== 'number' || !Number.isFinite(value.expires)) return undefined
    return value
  }

  const storeCredential = (credential, isCurrent = () => true) => mutateCredential(async () => {
    if (!isCurrent()) return false
    await ctx.credentials.modifyRecord(CREDENTIAL_KEY, async () => ({ kind: 'grant', payload: credential }))
    return true
  })

  const clearCredential = () => mutateCredential(() => ctx.credentials.deleteRecord(CREDENTIAL_KEY))

  const validCredential = async () => {
    const credential = await readCredential()
    if (credential === undefined) return undefined
    if (Date.now() + REFRESH_LEEWAY_MS < credential.expires) return credential

    if (refreshInFlight === null) {
      const revision = credentialRevision
      refreshInFlight = (async () => {
        const refreshed = await CODEX_OAUTH.refresh(credential, AbortSignal.timeout(REFRESH_TIMEOUT_MS))
        if (revision !== credentialRevision) throw new Error('credential changed during refresh')
        const stored = await storeCredential(refreshed, () => revision === credentialRevision)
        if (!stored || revision !== credentialRevision) throw new Error('credential changed during refresh')
        Object.assign(state, { loggedIn: true, expiresAt: refreshed.expires })
        return refreshed
      })().finally(() => { refreshInFlight = null })
    }
    return refreshInFlight
  }

  const getSnapshot = async () => {
    try {
      const credential = await validCredential()
      if (credential !== undefined) {
        Object.assign(state, { loggedIn: true, expiresAt: credential.expires })
        if (activeFlow === null) Object.assign(state, { status: 'done', error: '' })
      } else {
        Object.assign(state, { loggedIn: false, expiresAt: 0 })
        if (activeFlow === null && state.status === 'done') state.status = 'idle'
      }
    } catch {
      if (activeFlow === null) {
        Object.assign(state, {
          status: 'error',
          loggedIn: false,
          error: '无法刷新 Codex 登录状态，请重新登录。',
        })
      }
    }
    return snapshot()
  }

  const startLoginFlow = () => {
    activeFlow?.controller.abort('a new login was requested')
    const generation = ++flowGeneration
    const controller = new AbortController()
    const currentFlow = { controller, generation }
    activeFlow = currentFlow
    clearTransient()
    Object.assign(state, { status: 'starting' })

    void (async () => {
      try {
        const interaction = {
          signal: controller.signal,
          notify: (event) => {
            if (event?.type !== 'device_code') return
            if (typeof event.userCode !== 'string' || !/^[A-Z0-9-]{4,32}$/i.test(event.userCode)) {
              throw new Error('OpenAI returned an invalid device code')
            }
            Object.assign(state, {
              status: 'waiting',
              deviceCode: event.userCode,
              verificationUri: trustedVerificationUri(event.verificationUri),
            })
          },
          prompt: async (request) => {
            if (request?.type === 'select') return 'device_code'
            throw new Error('Unexpected prompt in the Codex device-code flow')
          },
        }

        const credential = await CODEX_OAUTH.login(interaction)
        if (generation !== flowGeneration || controller.signal.aborted) throw new Error('login cancelled')
        const revision = ++credentialRevision
        const stored = await storeCredential(credential, () => {
          return generation === flowGeneration && revision === credentialRevision && !controller.signal.aborted
        })
        if (!stored || generation !== flowGeneration || revision !== credentialRevision || controller.signal.aborted) {
          throw new Error('login cancelled')
        }
        clearTransient()
        Object.assign(state, { status: 'done', loggedIn: true, expiresAt: credential.expires })
      } catch {
        if (generation === flowGeneration) {
          clearTransient()
          Object.assign(state, {
            status: controller.signal.aborted ? 'idle' : 'error',
            loggedIn: false,
            expiresAt: 0,
            error: controller.signal.aborted ? '' : 'Codex 登录未完成，请重新发起登录。',
          })
        }
      } finally {
        if (activeFlow === currentFlow) activeFlow = null
      }
    })()
  }

  const logout = async () => {
    flowGeneration++
    credentialRevision++
    activeFlow?.controller.abort('logout requested')
    activeFlow = null
    await clearCredential()
    clearTransient()
    Object.assign(state, { status: 'idle', loggedIn: false, expiresAt: 0 })
    return getSnapshot()
  }

  Object.assign(handlers, {
    snapshot: getSnapshot,
    startLogin: async () => {
      if (activeFlow === null) startLoginFlow()
      return getSnapshot()
    },
    logout,
  })

  ctx.effect(() => () => {
    flowGeneration++
    credentialRevision++
    activeFlow?.controller.abort('plugin disposed')
  }, 'dsh-codex-bridge: abort login on dispose')
}

class CodexBridgeService extends CodexBridgeRemoteService {
  static inject = inject

  constructor(ctx) {
    const handlers = {}
    super(ctx, handlers)
    createService(ctx, handlers)
  }
}

export { CodexBridgeService, inject, name }
export default CodexBridgeService
