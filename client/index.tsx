import React from 'react'

const channel = '/dsh-codex-bridge'
const bundle = 'dsh-codex-bridge'

type Status = {
  ready: boolean
  flowAvailable: boolean
  signedIn: boolean
  phase: 'idle' | 'running' | 'authorized' | 'cancelled' | 'failed'
  message: string
  url: string
  code: string
  prompt?: { kind: string; message: string; placeholder?: string; options?: Array<{ id: string; label: string }> }
  error?: string
}
type RpcResponse<T> =
  | { ok: true; value: T }
  | { ok: false; error: { message?: string } }
type Rpc = { call(channel: string, endpoint: string, payload: unknown): Promise<RpcResponse<unknown>> }
type Api = {
  status(): Promise<RpcResponse<Status>>
  signIn(): Promise<RpcResponse<Status>>
  answer(value: string): Promise<RpcResponse<{ ok: boolean }>>
  cancel(): Promise<RpcResponse<{ ok: boolean }>>
  signOut(): Promise<RpcResponse<Status>>
}

const apiFor = (rpc: Rpc): Api => ({
  status: () => rpc.call(channel, 'status', {}) as Promise<RpcResponse<Status>>,
  signIn: () => rpc.call(channel, 'sign-in', {}) as Promise<RpcResponse<Status>>,
  answer: value => rpc.call(channel, 'answer', { value }) as Promise<RpcResponse<{ ok: boolean }>>,
  cancel: () => rpc.call(channel, 'cancel', {}) as Promise<RpcResponse<{ ok: boolean }>>,
  signOut: () => rpc.call(channel, 'sign-out', {}) as Promise<RpcResponse<Status>>,
})

const unwrap = <T,>(reply: RpcResponse<T>): T => {
  if (reply.ok) return reply.value
  throw new Error(reply.error.message || '无法连接 DSH 授权服务')
}

function LoginPanel({ api }: { api: Api }) {
  const [status, setStatus] = React.useState<Status>()
  const [input, setInput] = React.useState('')
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const refresh = React.useCallback(async () => {
    try { setStatus(unwrap(await api.status())) } catch (reason) { setError(String(reason)) }
  }, [api])
  React.useEffect(() => { void refresh() }, [refresh])
  React.useEffect(() => {
    if (status?.phase !== 'running') return
    const timer = window.setInterval(() => { void refresh() }, 1000)
    return () => window.clearInterval(timer)
  }, [status?.phase, refresh])
  const run = async (action: () => Promise<RpcResponse<unknown>>) => {
    setBusy(true)
    setError('')
    try { unwrap(await action()); await refresh() }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusy(false) }
  }

  return <section style={{ display: 'grid', gap: 12, maxWidth: 640 }}>
    <h2>Codex 登录</h2>
    <p>使用 DSH 内置的 ChatGPT OAuth。插件不注册模型适配器，凭据由 DSH 管理。</p>
    <div>状态：{status?.signedIn ? '已登录' : status?.phase === 'running' ? '等待授权' : '未登录'}</div>
    {!status?.ready && <div>DSH 授权/凭据服务尚未就绪。</div>}
    {!status?.flowAvailable && status?.ready && <div>当前 DSH 没有注册 openai-codex 登录流程；请检查 llm-pi-ai 插件是否启用。</div>}
    {status?.error && <div role="alert">{status.error}</div>}
    {status?.message && <div>{status.message}</div>}
    {status?.url && <a href={status.url} target="_blank" rel="noreferrer">打开 ChatGPT 授权页面（只打开一次）</a>}
    {status?.code && <div><strong>设备码：{status.code}</strong></div>}
    {status?.prompt && <div style={{ display: 'grid', gap: 8 }}>
      <label>{status.prompt.message}</label>
      {status.prompt.options?.length ? status.prompt.options.map(option =>
        <button key={option.id} disabled={busy} onClick={() => void run(() => api.answer(option.id))}>{option.label}</button>) :
        <div style={{ display: 'flex', gap: 8 }}>
          <input type={status.prompt?.kind === 'secret' ? 'password' : 'text'} value={input}
            placeholder={status.prompt.placeholder} onChange={event => setInput(event.target.value)} />
          <button disabled={busy || !input} onClick={() => void run(async () => {
            const result = await api.answer(input)
            if (result.ok) setInput('')
            return result
          })}>提交</button>
        </div>}
    </div>}
    <div style={{ display: 'flex', gap: 8 }}>
      {!status?.signedIn && <button disabled={busy || status?.phase === 'running' || !status?.flowAvailable}
        onClick={() => void run(() => api.signIn())}>使用 ChatGPT 账号登录</button>}
      {status?.phase === 'running' && <button disabled={busy} onClick={() => void run(() => api.cancel())}>取消</button>}
      {status?.signedIn && <button disabled={busy} onClick={() => {
        if (window.confirm('退出后需要重新登录才能使用 Codex 模型。确定退出？')) void run(() => api.signOut())
      }}>退出登录</button>}
    </div>
    {error && <div role="alert" style={{ color: 'var(--dsw-alias-state-error-primary, #b42318)' }}>{error}</div>}
  </section>
}

export const inject = ['slots', 'connection']

export function apply(ctx: any): void {
  const api = apiFor(ctx.get('connection').rpc)
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: bundle, order: 14, label: () => 'Codex 登录',
  }, () => <LoginPanel api={api} />))
}

export const name = bundle

