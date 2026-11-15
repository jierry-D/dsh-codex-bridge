import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'

const SERVICE = 'dsh-codex-bridge'
const NAMESPACE = 'codexBridge'

class CodexBridgeRemoteService extends TypertRemoteService {
  constructor(ctx, handlers) {
    super(ctx, SERVICE, { namespace: NAMESPACE })
    this.handlers = handlers
    for (const initialize of INITIALIZERS) initialize.call(this)
  }

  snapshot() { return this.handlers.snapshot() }
  startLogin() { return this.handlers.startLogin() }
  logout() { return this.handlers.logout() }
}

function remoteInitializer(prototype, method) {
  let initialize
  Remote(prototype[method], {
    kind: 'method',
    name: method,
    static: false,
    private: false,
    addInitializer(value) { initialize = value },
  })
  if (initialize === undefined) throw new Error(`failed to mark Remote method ${method}`)
  return initialize
}

const INITIALIZERS = ['snapshot', 'startLogin', 'logout'].map((method) => {
  return remoteInitializer(CodexBridgeRemoteService.prototype, method)
})

export { CodexBridgeRemoteService }
