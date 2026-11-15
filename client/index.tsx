import React from 'react'
import TYPERT_REMOTE from '../lib/remote.js'

type Snapshot = {
  status: 'idle' | 'starting' | 'waiting' | 'done' | 'error'
  loggedIn: boolean
  deviceCode: string
  verificationUri: string
  expiresAt: number
  error: string
}

type Remote = {
  snapshot(): Promise<Snapshot>
  startLogin(): Promise<Snapshot>
  logout(): Promise<Snapshot>
}

function LoginSection({ remote }: { remote: Remote }) {
  const [snapshot, setSnapshot] = React.useState<Snapshot>()
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')

  const refresh = React.useCallback(async () => {
    try {
      setSnapshot(await remote.snapshot())
      setError('')
    } catch {
      setError('无法连接 DSH Codex 服务，请重启 DSH 后重试。')
    }
  }, [remote])

  React.useEffect(() => { void refresh() }, [refresh])
  React.useEffect(() => {
    if (snapshot?.status !== 'starting' && snapshot?.status !== 'waiting') return
    const timer = window.setInterval(() => { void refresh() }, 1000)
    return () => window.clearInterval(timer)
  }, [snapshot?.status, refresh])

  const run = async (action: () => Promise<Snapshot>) => {
    setBusy(true)
    setError('')
    try {
      setSnapshot(await action())
      await refresh()
    } catch {
      setError('操作失败，请查看 DSH 日志后重试。')
    } finally {
      setBusy(false)
    }
  }

  const status = snapshot?.loggedIn
    ? '已登录'
    : snapshot?.status === 'waiting' ? '等待设备码授权'
      : snapshot?.status === 'starting' ? '正在启动登录'
        : snapshot?.status === 'error' ? '登录失败'
          : '未登录'

  return <section style={{ display: 'grid', gap: 12, maxWidth: 640 }}>
    <h2>OpenAI Codex 登录</h2>
    <p>使用 ChatGPT 账号设备码登录。设备码只显示在本地设置页，不会发送给模型或远端界面。</p>
    <div>状态：{status}</div>
    {snapshot?.error && <div role="alert">{snapshot.error}</div>}
    {snapshot?.status === 'waiting' && <>
      <p>打开授权页面，输入下面的设备码完成授权：</p>
      <a href={snapshot.verificationUri} target="_blank" rel="noreferrer">打开 OpenAI 设备授权页面</a>
      <strong style={{ fontSize: 22, letterSpacing: 2 }}>{snapshot.deviceCode}</strong>
    </>}
    {snapshot?.loggedIn && snapshot.expiresAt > 0 && <div>令牌有效期至：{new Date(snapshot.expiresAt).toLocaleString()}</div>}
    {!snapshot?.loggedIn
      ? <button disabled={busy || snapshot?.status === 'starting' || snapshot?.status === 'waiting'}
        onClick={() => void run(() => remote.startLogin())}>使用 ChatGPT 账号登录</button>
      : <button disabled={busy} onClick={() => {
        if (window.confirm('退出后需要重新登录才能使用 Codex 模型。确定退出？')) void run(() => remote.logout())
      }}>退出登录</button>}
    {error && <div role="alert" style={{ color: 'var(--dsw-alias-state-error-primary, #b42318)' }}>{error}</div>}
  </section>
}

function Section({ remote }: { remote?: Remote }) {
  if (!remote) return null
  return <LoginSection remote={remote} />
}

export const inject = ['slots', 'remote']

export async function apply(ctx: any): Promise<() => Promise<void>> {
  const disposeRemote = await ctx.remote.$mount(TYPERT_REMOTE)
  const remote = ctx.get('remote.codexBridge') as Remote | undefined
  if (!remote) {
    await disposeRemote()
    throw new Error('Codex Remote service did not mount')
  }
  const injected = () => ({ remote })
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'dsh-codex-bridge',
    order: 20,
    label: () => 'Codex 登录',
    inject: injected,
  }, Section))
  return async () => { await disposeRemote() }
}
