import React from 'react'

const namespace = 'codexBridge'
const bundle = 'dsh-codex-bridge'
const textSchema = Object.freeze({ '~standard': Object.freeze({
  version: 1,
  vendor: bundle,
  validate: (value: unknown) => typeof value === 'string' ? { value } : { issues: [{ message: 'expected string' }] },
}) })
const descriptor = (method: string, fields: string[] = []) => ({
  id: `${bundle}#${namespace}/${method}`,
  service: namespace,
  namespace,
  method,
  invocation: { kind: 'direct' },
  parameters: fields.map((name) => ({
    name, wire: name, source: 'json',
    codec: { mode: 'strict', typeSymbol: `${bundle}#${namespace}/${method}:${name}`, create: () => textSchema },
  })),
  result: { mode: 'src-json' },
})
const contribution = {
  package: bundle,
  descriptors: [descriptor('status'), descriptor('signIn'), descriptor('answer', ['value']), descriptor('cancel'), descriptor('signOut')],
}

type Status = {
  ready: boolean; flowAvailable: boolean; signedIn: boolean; phase: string
  message: string; url: string; code: string
  prompt?: { kind: string; message: string; placeholder?: string; options?: Array<{ id: string; label: string }> }
  error?: string
}
type Api = {
  status(): Promise<Response<Status>>
  signIn(): Promise<Response<Status>>
  answer(value: string): Promise<Response<{ ok: boolean }>>
  cancel(): Promise<Response<{ ok: boolean }>>
  signOut(): Promise<Response<Status>>
}
type Response<T> = { ok: boolean; value?: T; error?: { message?: string } }
const unwrap = <T,>(reply: Response<T>): T => {
  if (reply.ok && reply.value !== undefined) return reply.value
  throw new Error(reply.error?.message || '无法连接 DSH 授权服务')
}

function LoginPanel({ getApi }: { getApi: () => Api | undefined }) {
  const [status, setStatus] = React.useState<Status>()
  const [input, setInput] = React.useState('')
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const refresh = React.useCallback(async () => {
    const api = getApi()
    if (!api) return
    try { setStatus(unwrap(await api.status())) } catch (e) { setError(String(e)) }
  }, [getApi])
  React.useEffect(() => { void refresh() }, [refresh])
  React.useEffect(() => {
    if (status?.phase !== 'running') return
    const timer = window.setInterval(() => { void refresh() }, 1000)
    return () => window.clearInterval(timer)
  }, [status?.phase, refresh])
  React.useEffect(() => {
    if (status?.url && !status.code) window.open(status.url, '_blank', 'noopener,noreferrer')
  }, [status?.url, status?.code])
  const run = async (action: (api: Api) => Promise<Response<unknown>>) => {
    const api = getApi()
    if (!api) { setError('授权服务未连接，请重启 DSH 后重试。'); return }
    setBusy(true); setError('')
    try { unwrap(await action(api)); await refresh() } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }
  return <section style={{ display: 'grid', gap: 12, maxWidth: 640 }}>
    <h2>Codex 登录</h2>
    <p>使用 DSH 内置的 ChatGPT OAuth。插件不会注册模型适配器，也不会保存 token。</p>
    <div>状态：{status?.signedIn ? '已登录' : status?.phase === 'running' ? '等待授权' : '未登录'}</div>
    {!status?.ready && <div>DSH 授权/凭据服务尚未就绪。</div>}
    {!status?.flowAvailable && status?.ready && <div>当前 DSH 没有注册 openai-codex 登录流程；请检查 llm-pi-ai 插件是否启用。</div>}
    {status?.error && <div role="alert">{status.error}</div>}
    {status?.message && <div>{status.message}</div>}
    {status?.url && <a href={status.url} target="_blank" rel="noreferrer">打开 ChatGPT 授权页面</a>}
    {status?.code && <div><strong>设备码：{status.code}</strong></div>}
    {status?.prompt && <div style={{ display: 'grid', gap: 8 }}>
      <label>{status.prompt.message}</label>
      {status.prompt.options?.length ? status.prompt.options.map((option) =>
        <button key={option.id} disabled={busy} onClick={() => void run((api) => api.answer(option.id))}>{option.label}</button>) :
        <div style={{ display: 'flex', gap: 8 }}>
          <input type={status.prompt?.kind === 'secret' ? 'password' : 'text'} value={input}
            placeholder={status.prompt.placeholder} onChange={(e) => setInput(e.target.value)} />
          <button disabled={busy || !input} onClick={() => void run(async (api) => { await api.answer(input); setInput('') })}>提交</button>
        </div>}
    </div>}
    <div style={{ display: 'flex', gap: 8 }}>
      {!status?.signedIn && <button disabled={busy || status?.phase === 'running' || !status?.flowAvailable}
        onClick={() => void run((api) => api.signIn())}>使用 ChatGPT 账号登录</button>}
      {status?.phase === 'running' && <button disabled={busy} onClick={() => void run((api) => api.cancel())}>取消</button>}
      {status?.signedIn && <button disabled={busy} onClick={() => {
        if (window.confirm('退出后需要重新登录才能使用 Codex 模型。确定退出？')) void run((api) => api.signOut())
      }}>退出登录</button>}
    </div>
    {error && <div role="alert" style={{ color: 'var(--dsw-alias-state-error-primary, #b42318)' }}>{error}</div>}
  </section>
}

const inject = ['slots', 'remote']
function apply(ctx: any) {
  ctx.effect(() => {
    let dispose: (() => void) | undefined
    let unloaded = false
    ctx.remote.$mount(contribution).then((off: () => void) => {
      if (unloaded) off(); else dispose = off
    }).catch((err: unknown) => console.warn('[dsh-codex-bridge] remote unavailable', err))
    return () => { unloaded = true; dispose?.() }
  }, 'codex-bridge: remote service')
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'dsh-codex-bridge', order: 14, label: () => 'Codex 登录',
  }, () => <LoginPanel getApi={() => ctx.get(`remote.${namespace}`)} />))
}

export { apply, inject }
export const name = 'dsh-codex-bridge'

