import { AuthorizationDeclinedError, type AuthorizationService } from '@deepseek-ai/dsh-authorization'
import { credentialKey, type CredentialProvider } from '@deepseek-ai/dsh-credentials'
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'

const KEY = credentialKey('llm-pi-ai', 'openai-codex')
const CHANNEL = '/dsh-codex-bridge'
const MAX_BODY_BYTES = 16 * 1024

type PromptView = {
  kind: 'text' | 'secret' | 'select'
  message: string
  placeholder?: string
  options?: Array<{ id: string; label: string }>
}
type Prompt = { view: PromptView; answer(value: string): void; cancel(): void; withdraw(): void }
type Phase = 'idle' | 'running' | 'authorized' | 'cancelled' | 'failed'
type State = {
  phase: Phase
  message: string
  url: string
  code: string
  prompt?: Prompt
  error?: string
}
type RpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string; details: { issues: unknown[] } } }
type Deps = { auth?: AuthorizationService; credentials?: CredentialProvider }

export const name = 'dsh-codex-bridge'
export const inject = ['authorization', 'credentials', 'connection', 'webServer']

/** Adds a small, authenticated browser-to-Host channel for the existing Codex OAuth flow. */
export function apply(ctx: any): void {
  const deps: Deps = {}
  const state: State = { phase: 'idle', message: '', url: '', code: '' }

  const status = async () => {
    const record = await deps.credentials?.readRecord(KEY)
    const payload = record?.kind === 'grant' && typeof record.payload === 'object' && record.payload !== null
      ? record.payload as Record<string, unknown> : {}
    return {
      ready: !!deps.auth && !!deps.credentials,
      flowAvailable: deps.auth?.describe(KEY) !== undefined,
      signedIn: typeof payload.access === 'string' && payload.access.length > 0,
      phase: state.phase,
      message: state.message,
      url: state.url,
      code: state.code,
      prompt: state.prompt?.view,
      error: state.error,
    }
  }

  const signIn = async () => {
    const auth = deps.auth
    if (!auth) throw new Error('DSH 授权服务尚未就绪')
    if (auth.describe(KEY) === undefined) throw new Error('当前 DSH 没有注册 openai-codex 授权流程')
    if (state.phase === 'running') return status()
    Object.assign(state, { phase: 'running', message: '', url: '', code: '', error: undefined, prompt: undefined })
    const interaction = {
      notify: (notice: { message?: unknown; url?: unknown; code?: unknown }) => {
        state.message = typeof notice.message === 'string' ? notice.message : ''
        state.url = typeof notice.url === 'string' ? notice.url : ''
        state.code = typeof notice.code === 'string' ? notice.code : ''
      },
      prompt: (question: any) => new Promise<string>((resolve, reject) => {
        const view: PromptView = {
          kind: question.kind === 'secret' || question.kind === 'select' ? question.kind : 'text',
          message: typeof question.message === 'string' ? question.message : '请输入授权信息',
          placeholder: typeof question.placeholder === 'string' ? question.placeholder : undefined,
          options: question.kind === 'select' && Array.isArray(question.options)
            ? question.options.filter((option: any) => typeof option?.id === 'string' && typeof option?.label === 'string')
              .map((option: any) => ({ id: option.id, label: option.label }))
            : undefined,
        }
        let settled = false
        let prompt: Prompt
        const clear = () => { if (state.prompt === prompt) state.prompt = undefined }
        const removeAbortListener = () => question.signal?.removeEventListener('abort', withdraw)
        const withdraw = () => {
          if (settled) return
          settled = true
          removeAbortListener()
          clear()
          reject(new Error('授权提示已撤回'))
        }
        prompt = {
          view,
          answer: (value) => {
            if (settled) return
            settled = true
            removeAbortListener()
            clear()
            resolve(value)
          },
          cancel: () => {
            if (settled) return
            settled = true
            removeAbortListener()
            clear()
            reject(new AuthorizationDeclinedError('用户取消授权'))
          },
          withdraw,
        }
        if (question.signal?.aborted) {
          withdraw()
          return
        }
        state.prompt?.withdraw()
        state.prompt = prompt
        question.signal?.addEventListener('abort', withdraw, { once: true })
        if (question.signal?.aborted) withdraw()
      }),
    }
    void auth.begin({ key: KEY, method: 'oauth', interaction }).then(
      (result) => {
        state.prompt?.withdraw()
        state.phase = result.status === 'authorized' ? 'authorized' : 'cancelled'
      },
      (error) => {
        state.prompt?.withdraw()
        if (state.phase !== 'cancelled') {
          state.phase = 'failed'
          state.error = safeError(error)
        }
      },
    )
    return status()
  }

  const answer = async (value: unknown) => {
    if (typeof value !== 'string' || value.length === 0 || value.length > 2048) {
      throw new Error('输入内容无效')
    }
    if (!state.prompt) throw new Error('当前没有等待输入的授权问题')
    state.prompt.answer(value)
    return { ok: true }
  }

  const cancel = async () => {
    state.prompt?.cancel()
    await deps.auth?.cancel(KEY)
    state.phase = 'cancelled'
    return { ok: true }
  }

  const signOut = async () => {
    if (!deps.credentials) throw new Error('DSH 凭据服务尚未就绪')
    await deps.credentials.deleteRecord(KEY)
    state.phase = 'idle'
    return status()
  }

  const handler: ConnectionRpcHandler = async (endpoint, payload) => {
    try {
      if (endpoint === 'status' && isEmptyRecord(payload)) return { ok: true, value: await status() }
      if (endpoint === 'sign-in' && isEmptyRecord(payload)) return { ok: true, value: await signIn() }
      if (endpoint === 'answer' && isExactRecord(payload, ['value'])) {
        return { ok: true, value: await answer(payload.value) }
      }
      if (endpoint === 'cancel' && isEmptyRecord(payload)) return { ok: true, value: await cancel() }
      if (endpoint === 'sign-out' && isEmptyRecord(payload)) return { ok: true, value: await signOut() }
      return badRequest('invalid request')
    } catch (error) {
      return { ok: false, error: { code: 'authorization/failed', message: safeError(error), details: { issues: [] } } }
    }
  }

  ctx.inject(['authorization', 'credentials'], (scope: any) => {
    deps.auth = scope.authorization
    deps.credentials = scope.credentials
  })
  ctx.inject(['connection', 'webServer'], (scope: any) => {
    scope.effect(() => {
      const route: WebRoute = {
        kind: 'prefix',
        path: CHANNEL,
        handler: (req, res) => serveRoute(scope, handler, req, res),
      }
      return scope.webServer.register(route)
    }, 'dsh-codex-bridge: authenticated OAuth RPC')
  })
  ctx.effect(() => () => {
    state.prompt?.cancel()
    state.prompt = undefined
    void deps.auth?.cancel(KEY)
  }, 'dsh-codex-bridge: cancel pending OAuth')
}

async function serveRoute(ctx: any, handler: ConnectionRpcHandler, req: any, res: any): Promise<void> {
  const admission = ctx.connection.admit(req)
  if ('rejection' in admission) {
    res.writeHead(admission.rejection)
    res.end(admission.rejection === 401 ? 'unauthorized' : 'forbidden')
    return
  }
  const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname
  const endpoint = endpointFromPath(pathname)
  const mediaType = String(req.headers['content-type'] ?? '').split(';', 1)[0]?.trim().toLowerCase()
  if (req.method !== 'POST' || endpoint === undefined) return sendText(res, 404, 'not found')
  if (mediaType !== 'application/json') return sendText(res, 415, 'content type must be application/json')
  const body = await readBodyCapped(req, res)
  if (body === undefined) return
  let parsed: unknown
  try { parsed = JSON.parse(new TextDecoder().decode(body)) } catch { return sendText(res, 400, 'body is not JSON') }
  if (!isRecord(parsed) || parsed.type !== 'client-request'
    || typeof parsed.rpcId !== 'string' || parsed.rpcId.length === 0 || parsed.rpcId.length > 128
    || parsed.method !== endpoint || !('payload' in parsed)) {
    const rpcId = isRecord(parsed) && typeof parsed.rpcId === 'string' ? parsed.rpcId.slice(0, 128) : 'invalid-request'
    return sendJson(res, 200, { type: 'server-response', rpcId, result: badRequest('invalid request envelope') })
  }
  try {
    const controller = new AbortController()
    req.once('aborted', () => controller.abort())
    const result = await handler(endpoint, parsed.payload, controller.signal, admission.peer)
    sendJson(res, 200, { type: 'server-response', rpcId: parsed.rpcId, result })
  } catch {
    sendText(res, 500, 'request failed')
  }
}

async function readBodyCapped(req: AsyncIterable<Uint8Array> & { headers: Record<string, string | string[] | undefined> }, res: any): Promise<Uint8Array | undefined> {
  const declared = req.headers['content-length']
  if (declared !== undefined && Number(declared) > MAX_BODY_BYTES) {
    sendText(res, 413, 'request body too large')
    return undefined
  }
  const chunks: Uint8Array[] = []
  let length = 0
  for await (const chunk of req) {
    length += chunk.byteLength
    if (length > MAX_BODY_BYTES) {
      sendText(res, 413, 'request body too large')
      return undefined
    }
    chunks.push(chunk)
  }
  const body = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength }
  return body
}

function endpointFromPath(pathname: string): string | undefined {
  if (!pathname.startsWith(`${CHANNEL}/`)) return undefined
  const endpoint = pathname.slice(CHANNEL.length + 1)
  return /^[a-z-]+$/.test(endpoint) ? endpoint : undefined
}

function sendJson(res: any, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  const bytes = new TextEncoder().encode(payload)
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': String(bytes.byteLength) })
  res.end(bytes)
}

function sendText(res: any, status: number, text: string): void {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' })
  res.end(text)
}

function badRequest(message: string): RpcResult<never> {
  return { ok: false, error: { code: 'gateway/bad-request', message, details: { issues: [] } } }
}

function safeError(error: unknown): string {
  if (error instanceof Error && ['DSH 授权服务尚未就绪', '当前 DSH 没有注册 openai-codex 授权流程', '输入内容无效', '当前没有等待输入的授权问题', 'DSH 凭据服务尚未就绪'].includes(error.message)) {
    return error.message
  }
  const code = isRecord(error) && typeof error.code === 'string' ? error.code : undefined
  return code && /^[A-Z0-9_.-]{1,64}$/.test(code)
    ? `授权流程失败（${code}），请重试或查看 DSH 日志。`
    : '授权流程失败，请重试或查看 DSH 日志。'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isEmptyRecord(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length === 0
}

function isExactRecord(value: unknown, keys: string[]): value is Record<string, unknown> {
  return isRecord(value) && Object.keys(value).length === keys.length && keys.every(key => key in value)
}

