import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { AuthorizationDeclinedError, type AuthorizationService } from '@deepseek-ai/dsh-authorization'
import { credentialKey, type CredentialProvider } from '@deepseek-ai/dsh-credentials'

const KEY = credentialKey('llm-pi-ai', 'openai-codex')
type PromptView = { kind: 'text' | 'secret' | 'select'; message: string; placeholder?: string; options?: Array<{ id: string; label: string }> }
type LivePrompt = { view: PromptView; answer: (value: string) => void; cancel: () => void }
type State = { phase: 'idle' | 'running' | 'authorized' | 'cancelled' | 'failed'; message: string; url: string; code: string; prompt?: LivePrompt; error?: string }

/** Starts Harness's existing Codex OAuth flow; this package never implements OAuth or handles token values. */
export class CodexBridge extends TypertRemoteService {
  private readonly deps: { auth?: AuthorizationService; credentials?: CredentialProvider } = {}
  private readonly state: State = { phase: 'idle', message: '', url: '', code: '' }

  constructor(ctx: Context) {
    super(ctx, 'codexBridge')
    ctx.inject(['authorization'], (scope: Context) => { this.deps.auth = scope.authorization })
    ctx.inject(['credentials'], (scope: Context) => { this.deps.credentials = scope.credentials })
    ctx.effect(() => () => {
      this.state.prompt?.cancel()
      this.state.prompt = undefined
      void this.deps.auth?.cancel(KEY)
    }, 'codex-bridge: stop pending authorization')
  }

  @Remote
  async status() {
    const record = await this.deps.credentials?.readRecord(KEY)
    const payload = record?.kind === 'grant' && typeof record.payload === 'object' && record.payload !== null
      ? record.payload as Record<string, unknown> : {}
    return {
      ready: !!this.deps.auth && !!this.deps.credentials,
      flowAvailable: this.deps.auth?.describe(KEY) !== undefined,
      signedIn: typeof payload.access === 'string' && payload.access.length > 0,
      phase: this.state.phase,
      message: this.state.message,
      url: this.state.url,
      code: this.state.code,
      prompt: this.state.prompt?.view,
      error: this.state.error,
    }
  }

  @Remote
  async signIn() {
    const auth = this.deps.auth
    if (!auth) throw new Error('DSH 授权服务尚未就绪')
    if (auth.describe(KEY) === undefined) throw new Error('当前 DSH 没有注册 openai-codex 授权流程')
    if (this.state.phase === 'running') return this.status()
    Object.assign(this.state, { phase: 'running', message: '', url: '', code: '', error: undefined, prompt: undefined })
    const interaction = {
      notify: (notice: { message?: unknown; url?: unknown; code?: unknown }) => {
        this.state.message = typeof notice.message === 'string' ? notice.message : ''
        this.state.url = typeof notice.url === 'string' ? notice.url : ''
        this.state.code = typeof notice.code === 'string' ? notice.code : ''
      },
      prompt: (question: any) => new Promise<string>((resolve, reject) => {
        const view: PromptView = {
          kind: question.kind,
          message: question.message,
          placeholder: question.placeholder,
          options: question.kind === 'select' ? question.options.map((option: { id: string; label: string }) => ({ id: option.id, label: option.label })) : undefined,
        }
        const prompt: LivePrompt = {
          view,
          answer: (value) => { this.state.prompt = undefined; resolve(value) },
          cancel: () => { this.state.prompt = undefined; reject(new AuthorizationDeclinedError('用户取消授权')) },
        }
        this.state.prompt?.cancel()
        this.state.prompt = prompt
      }),
    }
    void auth.begin({ key: KEY, method: 'oauth', interaction } as any).then(
      (result) => { this.state.phase = result.status === 'authorized' ? 'authorized' : 'cancelled' },
      (error: unknown) => {
        if (this.state.phase !== 'cancelled') {
          this.state.phase = 'failed'
          this.state.error = error instanceof Error ? error.message : String(error)
        }
      },
    )
    return this.status()
  }

  @Remote
  async answer(value: string) {
    if (typeof value !== 'string' || value.length > 2048) throw new Error('输入内容无效')
    const prompt = this.state.prompt
    if (!prompt) throw new Error('当前没有等待输入的授权问题')
    prompt.answer(value)
    return { ok: true }
  }

  @Remote
  async cancel() {
    this.state.prompt?.cancel()
    await this.deps.auth?.cancel(KEY)
    this.state.phase = 'cancelled'
    return { ok: true }
  }

  @Remote
  async signOut() {
    if (!this.deps.credentials) throw new Error('DSH 凭据服务尚未就绪')
    await this.deps.credentials.deleteRecord(KEY)
    this.state.phase = 'idle'
    return this.status()
  }
}

export default CodexBridge
export const name = 'dsh-codex-bridge'

