import { z } from 'zod'

const PACKAGE = 'dsh-codex-bridge'
const SERVICE = 'dsh-codex-bridge'
const NAMESPACE = 'codexBridge'

const SnapshotSchema = z.object({
  status: z.enum(['idle', 'starting', 'waiting', 'done', 'error']),
  loggedIn: z.boolean(),
  deviceCode: z.string(),
  verificationUri: z.string(),
  expiresAt: z.number().finite(),
  error: z.string(),
}).strict().readonly()

const snapshotCodec = () => ({
  mode: 'strict',
  typeSymbol: `${PACKAGE}/remote#CodexBridgeSnapshot`,
  create: () => SnapshotSchema,
})

const descriptor = (method) => ({
  id: `${PACKAGE}#CodexBridgeRemote/${method}`,
  service: SERVICE,
  namespace: NAMESPACE,
  method,
  invocation: { kind: 'direct' },
  parameters: [],
  result: snapshotCodec(),
})

const descriptors = Object.freeze(['snapshot', 'startLogin', 'logout'].map(descriptor))

export const TYPERT_REMOTE = Object.freeze({ package: PACKAGE, descriptors })
export const TYPERT = Object.freeze({
  package: PACKAGE,
  face: 'host',
  schemas: Object.freeze([]),
  invocations: descriptors,
  model: Object.freeze({
    services: Object.freeze([]),
    events: Object.freeze([]),
    objects: Object.freeze([]),
  }),
})

export { NAMESPACE, SERVICE, SnapshotSchema }
export default TYPERT_REMOTE
